# -*- coding: utf-8 -*-
"""Flask 后端 - 澳门六合彩AI助手 v3 (Railway 部署版)"""

import os
import json
import logging
import requests
from datetime import datetime
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from config import (
    SILICONFLOW_API_KEY, SILICONFLOW_API_URL,
    AI_MODELS, CACHE_DURATION, SERVER_PORT
)
from scraper import LotteryScraper, get_zodiac, get_element, get_color, get_year_animal

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

app = Flask(__name__, template_folder='templates')
CORS(app)

# Global
scraper = LotteryScraper()
_draws_cache = []
_cache_source = ''
_cache_time = None
_preloaded = False


def enrich_draw(draw):
    """补全 draw 的属性字段"""
    sp = draw.get('special', 0)
    draw_date = draw.get('date', '')
    if not draw.get('color'):
        draw['color'] = get_color(sp)
    if not draw.get('zodiac'):
        draw['zodiac'] = get_zodiac(sp, draw_date)
    if not draw.get('wuxing'):
        draw['wuxing'] = get_element(sp)
    if 'head' not in draw:
        draw['head'] = sp // 10
    if 'tail' not in draw:
        draw['tail'] = sp % 10
    return draw


def preload_data():
    """预加载开奖数据（gunicorn 和直接运行都会调用）"""
    global _draws_cache, _cache_source, _cache_time, _preloaded
    if _preloaded:
        return

    logger.info('=' * 50)
    logger.info('  澳门六合彩AI助手 v3 (Railway)')
    logger.info('  当前生肖年: %s', get_year_animal())
    logger.info('=' * 50)
    logger.info('预加载开奖数据...')

    try:
        result = scraper.fetch_draws(100)
        if result and result.get('success') and result.get('data'):
            draws = result['data']
            for d in draws:
                enrich_draw(d)
            _draws_cache = draws
            _cache_source = result.get('source', 'API')
            _cache_time = datetime.now()

            sp = draws[0].get('special', 0)
            logger.info(
                '数据加载成功！共 %d 期，最新: 第%s期 特码%s 生肖%s',
                len(draws),
                draws[0].get('period', '?'),
                str(sp).zfill(2),
                draws[0].get('zodiac', '?')
            )
        else:
            logger.warning('数据加载失败，首次请求时会重试')
    except Exception as e:
        logger.error('预加载异常: %s', str(e))

    ai_status = '已配置' if (SILICONFLOW_API_KEY and SILICONFLOW_API_KEY != 'your_api_key_here') else '未配置'
    logger.info('AI API Key: %s', ai_status)
    logger.info('=' * 50)
    _preloaded = True


def build_system_prompt(draws):
    """构建 AI 系统提示词"""
    if not draws:
        return "你是一个澳门六合彩数据分析助手。"

    summary = scraper.get_analysis_summary(draws)
    prompt = (
        "你是一位专业的澳门六合彩数据分析师。以下是真实的历史开奖数据统计：\n\n"
        "%s\n\n"
        "请基于以上真实数据进行分析。注意：\n"
        "1. 所有分析必须基于上述真实统计数据\n"
        "2. 给出具体的数据支撑（出现次数、遗漏期数等）\n"
        "3. 彩票开奖是随机事件，你的分析仅供参考，需提醒用户理性投注\n"
        "4. 回答要有条理，分点列出\n"
        "5. 当前是%s年，号码1对应的生肖是%s"
    ) % (summary, get_year_animal(), get_year_animal())
    return prompt


# ======== API Routes ========

@app.route('/')
def serve_index():
    return render_template('index.html')


@app.route('/api/health')
def health():
    return jsonify({
        'success': True,
        'ai_configured': bool(SILICONFLOW_API_KEY and SILICONFLOW_API_KEY != 'your_api_key_here'),
        'year_animal': get_year_animal(),
        'time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    })


@app.route('/api/draws')
def get_draws():
    global _draws_cache, _cache_source, _cache_time

    count = request.args.get('count', 100, type=int)
    now = datetime.now()

    if _draws_cache and _cache_time and (now - _cache_time).seconds < CACHE_DURATION:
        return jsonify({
            'success': True,
            'data': _draws_cache[:count],
            'source': _cache_source + ' (缓存)',
            'count': len(_draws_cache[:count])
        })

    result = scraper.fetch_draws(count)
    if not result or not result.get('success') or not result.get('data'):
        if _draws_cache:
            return jsonify({
                'success': True,
                'data': _draws_cache[:count],
                'source': _cache_source + ' (旧缓存)',
                'count': len(_draws_cache[:count])
            })
        return jsonify({'success': False, 'error': '获取数据失败'}), 500

    draws = result['data']
    for d in draws:
        enrich_draw(d)

    _draws_cache = draws
    _cache_source = result.get('source', 'API')
    _cache_time = now

    return jsonify({
        'success': True,
        'data': draws[:count],
        'source': result.get('source', 'API'),
        'count': len(draws[:count])
    })


@app.route('/api/analysis')
def get_analysis():
    count = request.args.get('count', 100, type=int)

    draws = _draws_cache
    if not draws:
        result = scraper.fetch_draws(100)
        if result and result.get('success') and result.get('data'):
            draws = result['data']
            for d in draws:
                enrich_draw(d)

    if not draws:
        return jsonify({'success': False, 'error': '无数据'}), 500

    subset = draws[:count]
    total = len(subset)

    freq = {}
    all_freq = {}
    for i in range(1, 50):
        freq[i] = 0
        all_freq[i] = 0

    color_stats = {'红波': 0, '蓝波': 0, '绿波': 0}
    zodiac_stats = {}
    element_stats = {}
    head_stats = {}
    tail_stats = {}

    for d in subset:
        sp = d.get('special', 0)
        if 1 <= sp <= 49:
            freq[sp] += 1
            all_freq[sp] += 1
        for n in d.get('numbers', []):
            if 1 <= n <= 49:
                all_freq[n] += 1
        c = d.get('color', get_color(sp))
        if c in color_stats:
            color_stats[c] += 1
        z = d.get('zodiac', get_zodiac(sp, d.get('date')))
        zodiac_stats[z] = zodiac_stats.get(z, 0) + 1
        e = d.get('wuxing', get_element(sp))
        element_stats[e] = element_stats.get(e, 0) + 1
        h = sp // 10
        head_stats[str(h)] = head_stats.get(str(h), 0) + 1
        t = sp % 10
        tail_stats[str(t)] = tail_stats.get(str(t), 0) + 1

    missing = {}
    for num in range(1, 50):
        found = False
        for idx, d in enumerate(subset):
            if d.get('special') == num:
                missing[str(num)] = idx
                found = True
                break
        if not found:
            missing[str(num)] = total

    sorted_freq = sorted(freq.items(), key=lambda x: x[1], reverse=True)
    hot = [{'number': n, 'count': c} for n, c in sorted_freq[:20]]
    cold_list = list(reversed(sorted_freq[-20:]))
    cold = [{'number': n, 'count': c} for n, c in cold_list]

    return jsonify({
        'success': True,
        'data': {
            'total_draws': total,
            'hot_numbers': hot,
            'cold_numbers': cold,
            'missing_counts': missing,
            'color_distribution': color_stats,
            'zodiac_distribution': zodiac_stats,
            'element_distribution': element_stats,
            'head_distribution': head_stats,
            'tail_distribution': tail_stats,
            'special_freq': freq,
            'all_freq': all_freq,
        }
    })


@app.route('/api/models')
def get_models():
    return jsonify({
        'success': True,
        'data': [{'id': m['id'], 'name': m['name']} for m in AI_MODELS]
    })


@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.get_json()
    messages_input = data.get('messages', [])
    if not messages_input:
        single_msg = data.get('message', '')
        if not single_msg:
            return jsonify({'success': False, 'error': '缺少消息内容'}), 400
        history = data.get('history', [])
        messages_input = list(history) + [{'role': 'user', 'content': single_msg}]

    if not SILICONFLOW_API_KEY or SILICONFLOW_API_KEY == 'your_api_key_here':
        return jsonify({'success': False, 'error': 'AI API Key 未配置，请在 Railway 面板设置 SILICONFLOW_API_KEY 环境变量'}), 500

    model = data.get('model', AI_MODELS[0]['id'])
    draws = _draws_cache or []
    system_prompt = build_system_prompt(draws)

    api_messages = [{'role': 'system', 'content': system_prompt}]
    for m in messages_input[-10:]:
        api_messages.append({
            'role': m.get('role', 'user'),
            'content': m.get('content', '')
        })

    try:
        resp = requests.post(
            SILICONFLOW_API_URL,
            headers={
                'Authorization': 'Bearer ' + SILICONFLOW_API_KEY,
                'Content-Type': 'application/json'
            },
            json={
                'model': model,
                'messages': api_messages,
                'max_tokens': 2000,
                'temperature': 0.7
            },
            timeout=240
        )
        if resp.status_code != 200:
            error_msg = 'AI API 错误: HTTP %d' % resp.status_code
            try:
                err_data = resp.json()
                if 'error' in err_data:
                    error_msg = str(err_data['error'].get('message', error_msg))
            except Exception:
                pass
            return jsonify({'success': False, 'error': error_msg}), 500

        result = resp.json()
        reply = result['choices'][0]['message']['content']
        return jsonify({'success': True, 'reply': reply, 'model': model})

    except requests.Timeout:
        return jsonify({'success': False, 'error': 'AI 响应超时，请稍后重试'}), 500
    except Exception as e:
        logger.error('Chat error: %s', str(e))
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/banker-analyze', methods=['POST'])
def banker_analyze():
    """庄家助手 - 分析复式投注订单风险"""
    data = request.get_json()
    bets = data.get('bets', [])
    odds = float(data.get('odds', 47))
    model = data.get('model', AI_MODELS[0]['id'])

    if not bets or odds <= 0:
        return jsonify({'success': False, 'error': '请添加投注项'}), 400

    draws = _draws_cache or []
    total_draws = len(draws)
    today = datetime.now().strftime('%Y-%m-%d')

    number_amounts = {}
    bet_details = []

    for bet in bets:
        mode = bet.get('mode', 'number')
        value = bet.get('value')
        amount = float(bet.get('amount', 0))
        if amount <= 0:
            continue

        covered_nums = []
        if mode == 'number':
            n = int(value)
            if 1 <= n <= 49:
                covered_nums = [n]
        elif mode == 'zodiac':
            covered_nums = [n for n in range(1, 50) if get_zodiac(n, today) == value]
        elif mode == 'tail':
            tail_val = int(value)
            covered_nums = [n for n in range(1, 50) if n % 10 == tail_val]

        if not covered_nums:
            continue

        per_num_amount = amount / len(covered_nums)
        for n in covered_nums:
            number_amounts[n] = number_amounts.get(n, 0) + per_num_amount

        label_map = {
            'number': '号码%s' % str(value).zfill(2),
            'zodiac': '生肖%s' % value,
            'tail': '%s尾' % value,
        }
        bet_details.append({
            'mode': mode,
            'value': value,
            'amount': amount,
            'label': label_map.get(mode, str(value)),
            'coveredNums': covered_nums,
            'perNumAmount': round(per_num_amount, 2),
        })

    if not number_amounts:
        return jsonify({'success': False, 'error': '无有效投注'}), 400

    total_collected = sum(b.get('amount', 0) for b in bets if b.get('amount', 0) > 0)
    covered_numbers = sorted(number_amounts.keys())
    covered_count = len(covered_numbers)

    number_risks = []
    max_payout = 0
    max_payout_num = 0
    for n in covered_numbers:
        amt = number_amounts[n]
        payout = amt * odds
        net = total_collected - payout
        if payout > max_payout:
            max_payout = payout
            max_payout_num = n
        number_risks.append({
            'number': n,
            'amount': round(amt, 2),
            'payout': round(payout, 2),
            'net': round(net, 2),
            'color': get_color(n),
            'zodiac': get_zodiac(n, today),
        })

    max_loss = max_payout - total_collected
    if max_loss < 0:
        max_loss = 0

    num_freq = {}
    num_recent = {}
    num_missing = {}
    recent_range = min(20, total_draws)

    for n in range(1, 50):
        num_freq[n] = 0
        num_recent[n] = 0
        num_missing[n] = total_draws

    for i, d in enumerate(draws):
        sp = d.get('special', 0)
        if 1 <= sp <= 49:
            num_freq[sp] += 1
            if i < recent_range:
                num_recent[sp] += 1
            if num_missing[sp] == total_draws:
                num_missing[sp] = i

    ev_base = total_collected
    ev_adjusted = total_collected
    weighted_prob_sum = 0

    for n in covered_numbers:
        base_p = 1.0 / 49.0
        hist_p = num_freq[n] / total_draws if total_draws > 0 else base_p
        adj_p = 0.7 * base_p + 0.3 * hist_p
        payout = number_amounts[n] * odds
        ev_base -= base_p * payout
        ev_adjusted -= adj_p * payout
        weighted_prob_sum += adj_p

    base_prob_total = covered_count / 49.0
    adj_prob_total = weighted_prob_sum
    ev_ratio = ev_adjusted / total_collected if total_collected > 0 else 0

    worst_num = max(number_risks, key=lambda x: x['payout'])
    min_missing = min(num_missing[n] for n in covered_numbers)
    total_recent_hits = sum(num_recent[n] for n in covered_numbers)

    if ev_ratio > 0.15:
        rec = 'accept'
        rec_text = '建议吃单'
        risk_level = '低风险'
    elif ev_ratio > 0.05:
        rec = 'accept'
        rec_text = '建议吃单'
        risk_level = '中低风险'
    elif ev_ratio > 0:
        rec = 'caution'
        rec_text = '谨慎考虑'
        risk_level = '中风险'
    else:
        rec = 'reject'
        rec_text = '建议拒单'
        risk_level = '高风险'

    if max_loss > 50000 and rec == 'accept':
        rec = 'caution'
        rec_text = '谨慎考虑'
        risk_level += '（大额单）'

    if total_recent_hits > covered_count * recent_range / 49 * 2 and rec != 'reject':
        risk_level += '（近期活跃）'
        if rec == 'accept' and ev_ratio < 0.10:
            rec = 'caution'
            rec_text = '谨慎考虑'

    number_risks.sort(key=lambda x: -x['payout'])

    math_result = {
        'coveredCount': covered_count,
        'coveredNumbers': covered_numbers,
        'numberAmounts': {str(k): round(v, 2) for k, v in number_amounts.items()},
        'numberRisks': number_risks[:20],
        'totalCollected': round(total_collected, 2),
        'baseProb': round(base_prob_total * 100, 2),
        'adjustedProb': round(adj_prob_total * 100, 2),
        'evBase': round(ev_base, 2),
        'evAdjusted': round(ev_adjusted, 2),
        'evRatio': round(ev_ratio * 100, 2),
        'maxLoss': round(max_loss, 2),
        'maxPayoutNum': max_payout_num,
        'maxPayout': round(max_payout, 2),
        'maxProfit': round(total_collected, 2),
        'recentHits': total_recent_hits,
        'recentRange': recent_range,
        'minMissing': min_missing,
        'totalDraws': total_draws,
        'recommendation': rec,
        'recText': rec_text,
        'risk': risk_level,
        'worstNum': worst_num,
        'betDetails': bet_details,
    }

    # Build AI prompt
    lines = []
    lines.append('你是一位六合彩庄家的风险分析顾问。请分析以下复式投注订单：')
    lines.append('')
    lines.append('【订单明细】')
    lines.append('赔率: %.1f倍' % odds)
    lines.append('总收入（如果吃单）: %.0f元' % total_collected)
    lines.append('')
    for bd in bet_details:
        nums_str = ','.join(str(n) for n in bd['coveredNums'])
        lines.append('- %s: %.0f元 -> 覆盖号码[%s] 每号%.1f元' % (
            bd['label'], bd['amount'], nums_str, bd['perNumAmount']))
    lines.append('')
    lines.append('【号码风险分布（按赔付金额从高到低前10）】')
    for nr in number_risks[:10]:
        freq_info = '%d/%d期' % (num_freq[nr['number']], total_draws)
        miss_info = '遗漏%d期' % num_missing[nr['number']]
        nr_num_str = str(nr['number']).zfill(2)
        nr_color = get_color(nr['number'])
        loss_val = abs(nr['net']) if nr['net'] < 0 else 0
        line = '  号码%s: 投注%.1f元, 赔付%.0f元, 净亏%.0f元 | 历史%s | %s | %s %s' % (
            nr_num_str, nr['amount'], nr['payout'], loss_val,
            freq_info, miss_info, nr['zodiac'], nr_color)
        lines.append(line)
    lines.append('')
    lines.append('【数学分析】')
    lines.append('覆盖号码数: %d/49' % covered_count)
    lines.append('综合中奖概率: %.2f%%' % (adj_prob_total * 100))
    lines.append('庄家期望收益: %.2f元 (收益率%.1f%%)' % (ev_adjusted, ev_ratio * 100))
    worst_num_str = str(max_payout_num).zfill(2)
    lines.append('最坏情况: 号码%s中奖, 赔付%.0f元, 净亏%.0f元' % (
        worst_num_str, max_payout, max_loss))
    lines.append('近%d期覆盖号码命中: %d次' % (recent_range, total_recent_hits))
    lines.append('')
    lines.append('请给出简洁有力的分析：')
    lines.append('1. **【结论】** 吃单/拒单/谨慎，用一句话说核心原因')
    lines.append('2. **【风险分析】** 重点关注哪些高风险号码，资金敞口分布')
    lines.append('3. **【走势解读】** 结合近期走势和遗漏值，哪些号码最危险')
    lines.append('4. **【建议】** 如果部分吃单，建议拒绝哪些投注项保留哪些')

    ai_analysis = None
    if SILICONFLOW_API_KEY and SILICONFLOW_API_KEY != 'your_api_key_here':
        system_prompt = build_system_prompt(draws)
        prompt = '\n'.join(lines)
        try:
            resp = requests.post(
                SILICONFLOW_API_URL,
                headers={
                    'Authorization': 'Bearer ' + SILICONFLOW_API_KEY,
                    'Content-Type': 'application/json'
                },
                json={
                    'model': model,
                    'messages': [
                        {'role': 'system', 'content': system_prompt},
                        {'role': 'user', 'content': prompt}
                    ],
                    'max_tokens': 2000,
                    'temperature': 0.5
                },
                timeout=60
            )
            if resp.status_code == 200:
                result = resp.json()
                ai_analysis = result['choices'][0]['message']['content']
            else:
                logger.error('Banker AI HTTP %d', resp.status_code)
        except Exception as e:
            logger.error('Banker AI error: %s', str(e))

    return jsonify({
        'success': True,
        'math': math_result,
        'aiAnalysis': ai_analysis,
    })


# ======== Startup ========
# gunicorn 启动时预加载数据
preload_data()

if __name__ == '__main__':
    logger.info('本地开发模式，监听端口 %d', SERVER_PORT)
    logger.info('请用浏览器打开: http://localhost:%d', SERVER_PORT)
    app.run(host='0.0.0.0', port=SERVER_PORT, debug=False, use_reloader=False)
