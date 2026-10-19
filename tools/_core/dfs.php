<?php
/**
 * DataForSEO client: endpoint allowlist, 7-day cache, daily spend cap, cost log.
 * One DataForSEO call per request, so no request gets near PHP's time limit.
 */
if (!defined('OT_CORE')) { http_response_code(404); exit; }

const OT_DFS_ALLOWED = [
    'dataforseo_labs/google/domain_rank_overview/live',
    'dataforseo_labs/google/ranked_keywords/live',
    'dataforseo_labs/google/keywords_for_site/live',
    'dataforseo_labs/google/related_keywords/live',
    'dataforseo_labs/google/keyword_suggestions/live',
    'dataforseo_labs/google/serp_competitors/live',
    'keywords_data/google_ads/search_volume/live',
    'serp/google/organic/live/advanced',
    'backlinks/summary/live',
    'ai_optimization/claude/llm_responses/live',
    'ai_optimization/chat_gpt/llm_responses/live',
    'on_page/task_post',
];
// On-Page crawl results are read with GET on_page/summary/<task id>
const OT_DFS_SUMMARY = '#^on_page/summary/[0-9a-f\\-]{20,60}$#';

function ot_dfs_allowed($endpoint) {
    return in_array($endpoint, OT_DFS_ALLOWED, true) || preg_match(OT_DFS_SUMMARY, $endpoint);
}

function ot_dfs_raw($endpoint, $task = null) {
    $ch = curl_init(ot_cfg('dfs_base') . $endpoint);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT        => 90,
        CURLOPT_USERPWD        => ot_cfg('dfs_login') . ':' . ot_cfg('dfs_password'),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    ]);
    if ($task !== null) { curl_setopt($ch, CURLOPT_POST, true); curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([$task])); }
    $body = curl_exec($ch);
    $err  = curl_error($ch);
    curl_close($ch);
    if ($body === false) return ['status_code' => 0, 'status_message' => 'Network error: ' . $err, 'cost' => 0, 'result' => null];
    $j = json_decode($body, true);
    if (!is_array($j)) return ['status_code' => 0, 'status_message' => 'Bad response from DataForSEO', 'cost' => 0, 'result' => null];
    $t = $j['tasks'][0] ?? [];
    return [
        'status_code'    => $t['status_code'] ?? ($j['status_code'] ?? 0),
        'status_message' => $t['status_message'] ?? ($j['status_message'] ?? ''),
        'cost'           => (float) ($t['cost'] ?? 0),
        'result'         => $t['result'] ?? null,
        'id'             => $t['id'] ?? null,
    ];
}

function ot_dfs($endpoint, $task, $fresh = false, $tool = '') {
    if (!ot_dfs_allowed($endpoint)) return ['status_code' => 403, 'status_message' => 'Endpoint not allowed: ' . $endpoint, 'cost' => 0, 'result' => null];
    if (!ot_cfg('dfs_login') || !ot_cfg('dfs_password')) return ['status_code' => 500, 'status_message' => 'DataForSEO keys are not set on the server', 'cost' => 0, 'result' => null];
    $key  = sha1($endpoint . json_encode($task));
    $path = ot_data_dir('cache') . '/dfs-' . $key . '.json.php';
    if (!$fresh && is_file($path) && time() - filemtime($path) < ot_cfg('cache_days') * 86400) {
        $r = ot_read($path);
        if ($r) { $r['cached'] = true; $r['cost'] = 0; return $r; }
    }
    $spent = ot_spend('dfs');
    if ($spent >= ot_cfg('cap_dfs')) return ['status_code' => 429, 'status_message' => sprintf('Daily DataForSEO limit reached ($%.2f of $%.2f). Raise cap_dfs in config.php or try tomorrow.', $spent, ot_cfg('cap_dfs')), 'cost' => 0, 'result' => null];
    $t0 = microtime(true);
    $isSummary = (bool) preg_match(OT_DFS_SUMMARY, $endpoint);
    $r  = ot_dfs_raw($endpoint, $isSummary ? null : $task);
    $r['seconds'] = round(microtime(true) - $t0, 2);
    if ($r['cost'] > 0) ot_spend('dfs', $r['cost']);
    ot_log(['svc' => 'dfs', 'tool' => $tool, 'ep' => $endpoint, 'cost' => $r['cost'], 's' => $r['seconds'], 'ok' => $r['status_code'] == 20000]);
    // cache successful calls; a crawl summary only once the crawl has finished
    $done = !$isSummary || (($r['result'][0]['crawl_progress'] ?? '') === 'finished');
    if (in_array((int) $r['status_code'], [20000, 20100], true) && $done) ot_write($path, $r);
    return $r;
}
