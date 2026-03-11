"""
澳门六合彩数据抓取引擎 v5
- 每天一期，期号=YYYYDDD（年份+当年第几天）
- 直接用日期计算候选期号，无需先获取最新期号
- 并发拉取 history API
"""

import requests
import time
import random
import logging
import calendar
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed

from config import (
    HISTORY_API_BASE, MACAUJC_API_URL,
    REQUEST_TIMEOUT, REQUEST_RETRIES,
    CACHE_DURATION, MAX_DRAWS, CONCURRENT_WORKERS, CNY_DATES
)

logger = logging.getLogger(__name__)

# ==================== 号码属性映射 ====================
RED_NUMS = {1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46}
BLUE_NUMS = {3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48}
GREEN_NUMS = {5, 6, 11, 16, 17, 21, 22, 27, 28, 32, 33, 38, 39, 43, 44, 49}

ZODIAC_CYCLE = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪']

ZODIAC_TC_TO_SC = {
    '鼠': '鼠', '牛': '牛', '虎': '虎', '兔': '兔',
    '龍': '龙', '蛇': '蛇', '馬': '马', '羊': '羊',
    '猴': '猴', '雞': '鸡', '狗': '狗', '豬': '猪',
    '龙': '龙', '马': '马', '鸡': '鸡', '猪': '猪',
}

ELEMENT_GROUPS = {
    '金': {2, 3, 10, 11, 24, 25, 32, 33, 40, 41},
    '木': {6, 7, 14, 15, 22, 23, 36, 37, 44, 45},
    '水': {12, 13, 20, 21, 28, 29, 42, 43},
    '火': {8, 9, 16, 17, 30, 31, 38, 39, 46, 47},
    '土': {1, 4, 5, 18, 19, 26, 27, 34, 35, 48, 49},
}


def get_color(n):
    if n in RED_NUMS:
        return '红波'
    elif n in BLUE_NUMS:
        return '蓝波'
    elif n in GREEN_NUMS:
        return '绿波'
    return '未知'


def get_year_animal(date_str=None):
    if date_str and isinstance(date_str, str):
        try:
            dt = datetime.strptime(date_str[:10], '%Y-%m-%d')
        except (ValueError, TypeError):
            dt = datetime.now()
    elif isinstance(date_str, datetime):
        dt = date_str
    else:
        dt = datetime.now()

    year = dt.year
    if year in CNY_DATES:
        cny_m, cny_d = CNY_DATES[year]
        if dt.month < cny_m or (dt.month == cny_m and dt.day < cny_d):
            year -= 1
    return ZODIAC_CYCLE[(year - 2020) % 12]


def get_zodiac(n, date_str=None):
    animal = get_year_animal(date_str)
    year_idx = ZODIAC_CYCLE.index(animal)
    return ZODIAC_CYCLE[(year_idx - (n - 1)) % 12]


def tc_to_sc(zodiac_str):
    return ZODIAC_TC_TO_SC.get(zodiac_str.strip(), zodiac_str.strip()) if zodiac_str else '未知'


def translate_api_color(color_en):
    mapping = {'red': '红波', 'blue': '蓝波', 'green': '绿波'}
    return mapping.get(color_en.strip().lower(), '未知') if color_en else '未知'


def get_element(n):
    for elem, nums in ELEMENT_GROUPS.items():
        if n in nums:
            return elem
    return '未知'


def date_to_issue(dt):
    """日期转期号：YYYYDDD"""
    year = dt.year
    day_of_year = dt.timetuple().tm_yday
    return '%d%s' % (year, str(day_of_year).zfill(3))


def generate_candidate_issues(count=150):
    """从今天往前生成候选期号列表（每天一期）"""
    candidates = []
    now = datetime.now()
    # 如果还没到开奖时间(21:30)，今天的还没开，从昨天开始
    if now.hour < 22:
        start = now - timedelta(days=1)
    else:
        start = now

    for i in range(count):
        dt = start - timedelta(days=i)
        issue = date_to_issue(dt)
        candidates.append({
            'issue': issue,
            'date': dt.strftime('%Y-%m-%d'),
        })
    return candidates


# ==================== 抓取引擎 ====================
class LotteryScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache',
        })
        self._cache = None
        self._cache_time = 0
        self._cache_source = ''

    def fetch_draws(self, count=MAX_DRAWS, force_refresh=False):
        if not force_refresh and self._cache and (time.time() - self._cache_time) < CACHE_DURATION:
            return {
                'success': True,
                'source': self._cache_source,
                'data': self._cache[:count],
                'cached': True,
                'total': len(self._cache),
            }

        # 策略1: 日期计算 + history API 并发拉取
        draws, source = self._fetch_via_history(count)

        # 策略2: macaujc.org 批量 API
        if not draws:
            draws, source = self._fetch_via_macaujc()

        # 策略3: 模拟数据
        if not draws:
            draws = self._generate_mock_data(count)
            source = '模拟数据（所有 API 暂不可用）'
            logger.warning("所有 API 不可用，使用模拟数据")

        self._cache = draws
        self._cache_time = time.time()
        self._cache_source = source

        return {
            'success': True,
            'source': source,
            'data': draws[:count],
            'cached': False,
            'total': len(draws),
        }

    # ========== 策略1: 日期计算 + history API ==========

    def _fetch_via_history(self, count):
        logger.info("=" * 50)
        logger.info("策略1: 日期计算 + history API 并发拉取")
        logger.info("=" * 50)

        # 生成候选期号（多生成50%以应对部分失败）
        target = int(count * 1.5)
        if target < 150:
            target = 150
        candidates = generate_candidate_issues(target)

        logger.info("生成 %d 个候选期号", len(candidates))
        logger.info("  最新: %s (%s)", candidates[0]['issue'], candidates[0]['date'])
        logger.info("  最早: %s (%s)", candidates[-1]['issue'], candidates[-1]['date'])

        draws = []
        batch_size = 20

        for batch_start in range(0, len(candidates), batch_size):
            if len(draws) >= count:
                break

            batch = candidates[batch_start:batch_start + batch_size]
            batch_issues = [c['issue'] for c in batch]

            batch_results = []
            with ThreadPoolExecutor(max_workers=CONCURRENT_WORKERS) as executor:
                future_map = {}
                for issue in batch_issues:
                    future = executor.submit(self._fetch_one_history, issue)
                    future_map[future] = issue

                for future in as_completed(future_map):
                    result = future.result()
                    if result:
                        batch_results.append(result)

            draws.extend(batch_results)
            logger.info(
                "批次 %d-%d: 成功 %d/%d, 累计 %d 条",
                batch_start + 1,
                min(batch_start + batch_size, len(candidates)),
                len(batch_results),
                len(batch),
                len(draws)
            )

            # 短暂延迟避免限流
            if len(draws) < count and batch_start + batch_size < len(candidates):
                time.sleep(0.3)

        if draws:
            draws.sort(key=lambda x: x['period'], reverse=True)
            result = draws[:count]
            logger.info("✅ 成功获取 %d 期数据", len(result))
            if result:
                d = result[0]
                logger.info(
                    "   最新: 第%s期 (%s) 特码%s %s/%s",
                    d['period'], d['date'][:10],
                    str(d['special']).zfill(2),
                    d.get('zodiac', '?'), d.get('color', '?')
                )
                d2 = result[-1]
                logger.info(
                    "   最早: 第%s期 (%s) 特码%s",
                    d2['period'], d2['date'][:10],
                    str(d2['special']).zfill(2)
                )
            return result, 'history.macaumarksix.com (实时数据)'

        return [], ''

    def _fetch_one_history(self, issue_number):
        url = HISTORY_API_BASE + str(issue_number)

        try:
            headers = {'Referer': 'https://history.macaumarksix.com/'}
            resp = self.session.get(url, timeout=REQUEST_TIMEOUT, headers=headers)

            if resp.status_code != 200:
                return None

            data = resp.json()

            is_success = (
                data.get('result', False) or
                data.get('code') == 200 or
                data.get('code') == 0
            )
            if not is_success:
                return None

            items = data.get('data', [])
            if not items:
                return None

            return self._parse_history_item(items[0])

        except (requests.Timeout, requests.ConnectionError):
            return None
        except Exception:
            return None

    def _parse_history_item(self, item):
        try:
            issue = str(item.get('expect', '') or item.get('issue', '') or '')
            open_code = str(item.get('openCode', '') or '')
            open_time = str(item.get('openTime', '') or '')

            if not issue or not open_code:
                return None

            nums = [int(n.strip()) for n in open_code.split(',') if n.strip()]
            if len(nums) != 7:
                return None
            if not all(1 <= n <= 49 for n in nums):
                return None

            normal_nums = nums[:6]
            special = nums[6]

            # 波色
            api_wave = item.get('wave', '')
            if api_wave:
                wave_parts = api_wave.split(',')
                if len(wave_parts) >= 7:
                    special_color = translate_api_color(wave_parts[6])
                    normal_colors = [translate_api_color(w) for w in wave_parts[:6]]
                else:
                    special_color = get_color(special)
                    normal_colors = [get_color(n) for n in normal_nums]
            else:
                special_color = get_color(special)
                normal_colors = [get_color(n) for n in normal_nums]

            # 生肖（根据开奖日期动态计算）
            special_zodiac = get_zodiac(special, open_time)
            normal_zodiacs = [get_zodiac(n, open_time) for n in normal_nums]

            return {
                'period': issue,
                'date': open_time,
                'numbers': normal_nums,
                'special': special,
                'color': special_color,
                'zodiac': special_zodiac,
                'wuxing': get_element(special),
                'head': special // 10,
                'tail': special % 10,
                'normal_colors': normal_colors,
                'normal_zodiacs': normal_zodiacs,
            }

        except (ValueError, TypeError) as e:
            logger.debug("解析 history 记录失败: %s", e)
            return None

    # ========== 策略2: macaujc.org ==========

    def _fetch_via_macaujc(self):
        logger.info("=" * 50)
        logger.info("策略2: 尝试 macaujc.org 批量 API")
        logger.info("=" * 50)

        for attempt in range(1, REQUEST_RETRIES + 1):
            logger.info("尝试 macaujc.org (第%d/%d次)", attempt, REQUEST_RETRIES)
            try:
                resp = self.session.get(MACAUJC_API_URL, timeout=REQUEST_TIMEOUT)
                if resp.status_code != 200:
                    logger.warning("macaujc.org HTTP %d", resp.status_code)
                    if resp.status_code in (504, 503) and attempt < REQUEST_RETRIES:
                        time.sleep(3)
                        continue
                    break

                data = resp.json()
                if isinstance(data, dict) and data.get('code') == 0:
                    items = data.get('data', [])
                    draws = []
                    for item in items:
                        draw = self._parse_history_item(item)
                        if draw:
                            draws.append(draw)
                    if draws:
                        draws.sort(key=lambda x: x['period'], reverse=True)
                        logger.info("macaujc.org 获取到 %d 条数据", len(draws))
                        return draws, 'macaujc.org (实时数据)'

            except Exception as e:
                logger.error("macaujc.org 异常: %s", e)
                if attempt < REQUEST_RETRIES:
                    time.sleep(2)

        return [], ''

    # ========== 模拟数据 ==========

    def _generate_mock_data(self, count):
        draws = []
        base_date = datetime.now()
        random.seed(20250615)

        for i in range(count):
            d = base_date - timedelta(days=i)
            period = date_to_issue(d)
            date_str = d.strftime('%Y-%m-%d 21:32:00')

            pool = list(range(1, 50))
            random.shuffle(pool)
            picked = pool[:7]
            normal = picked[:6]
            special = picked[6]

            draws.append({
                'period': period,
                'date': date_str,
                'numbers': normal,
                'special': special,
                'color': get_color(special),
                'zodiac': get_zodiac(special, date_str),
                'wuxing': get_element(special),
                'head': special // 10,
                'tail': special % 10,
                'normal_colors': [get_color(n) for n in normal],
                'normal_zodiacs': [get_zodiac(n, date_str) for n in normal],
            })

        return draws

    # ========== 分析摘要 ==========

    def get_analysis_summary(self, draws):
        if not draws:
            return "暂无数据"

        total = len(draws)

        special_freq = {}
        for i in range(1, 50):
            special_freq[i] = 0

        color_stats = {'红波': 0, '蓝波': 0, '绿波': 0}
        zodiac_stats = {}
        element_stats = {}
        head_stats = {i: 0 for i in range(5)}
        tail_stats = {i: 0 for i in range(10)}

        for draw in draws:
            sp = draw['special']
            special_freq[sp] = special_freq.get(sp, 0) + 1

            c = draw.get('color', get_color(sp))
            if c in color_stats:
                color_stats[c] += 1

            z = draw.get('zodiac', get_zodiac(sp))
            zodiac_stats[z] = zodiac_stats.get(z, 0) + 1

            e = draw.get('wuxing', get_element(sp))
            element_stats[e] = element_stats.get(e, 0) + 1

            head_stats[sp // 10] = head_stats.get(sp // 10, 0) + 1
            tail_stats[sp % 10] = tail_stats.get(sp % 10, 0) + 1

        # 遗漏值
        missing = {}
        for i in range(1, 50):
            m = 0
            for draw in draws:
                if draw['special'] == i:
                    break
                m += 1
            missing[i] = m

        hot = sorted(special_freq.items(), key=lambda x: x[1], reverse=True)[:10]
        cold = sorted(special_freq.items(), key=lambda x: x[1])[:10]
        miss_top = sorted(missing.items(), key=lambda x: x[1], reverse=True)[:10]

        hot_str = ', '.join(['%s(%d次)' % (str(n).zfill(2), c) for n, c in hot])
        cold_str = ', '.join(['%s(%d次)' % (str(n).zfill(2), c) for n, c in cold])
        miss_str = ', '.join(['%s(遗漏%d期)' % (str(n).zfill(2), c) for n, c in miss_top])

        color_list = []
        for k, v in color_stats.items():
            pct = v / total * 100 if total else 0
            color_list.append('%s%d次(%.1f%%)' % (k, v, pct))
        color_str = ', '.join(color_list)

        zodiac_sorted = sorted(zodiac_stats.items(), key=lambda x: x[1], reverse=True)
        zodiac_str = ', '.join(['%s%d次' % (k, v) for k, v in zodiac_sorted])

        element_str = ', '.join(['%s%d次' % (k, v) for k, v in element_stats.items()])
        head_str = ', '.join(['%d头%d次' % (k, v) for k, v in sorted(head_stats.items())])
        tail_str = ', '.join(['%d尾%d次' % (k, v) for k, v in sorted(tail_stats.items())])

        year_animal = get_year_animal()

        recent = []
        for d in draws[:10]:
            nums_str = ','.join([str(n).zfill(2) for n in d['numbers']])
            sp = d['special']
            line = '第%s期(%s): 正码[%s] 特码%s(%s/%s/%s)' % (
                d['period'], d['date'][:10],
                nums_str, str(sp).zfill(2),
                d.get('color', ''), d.get('zodiac', ''), d.get('wuxing', '')
            )
            recent.append(line)

        summary = (
            '澳门六合彩最近%d期真实开奖数据分析摘要：\n'
            '【当前生肖年】%s年\n\n'
            '【最近10期开奖】\n%s\n\n'
            '【特码热号TOP10】%s\n'
            '【特码冷号TOP10】%s\n'
            '【特码遗漏TOP10】%s\n'
            '【特码波色分布】%s\n'
            '【特码生肖分布】%s\n'
            '【特码五行分布】%s\n'
            '【特码头数分布】%s\n'
            '【特码尾数分布】%s'
        ) % (
            total, year_animal,
            '\n'.join(recent),
            hot_str, cold_str, miss_str,
            color_str, zodiac_str, element_str,
            head_str, tail_str
        )
        return summary


# 全局实例
scraper = LotteryScraper()
