<?php
/**
 * Claude API client for named AI tasks (prompts.json).
 * The browser sends a task name, data and the optional note. The system prompt never leaves the server,
 * so the endpoint can't be used as a general chatbot.
 * Answers are JSON only, cached for 7 days, retried once on overload. If the Claude API is unavailable
 * the response says fallback:true and the browser switches to the DataForSEO route.
 */
if (!defined('OT_CORE')) { http_response_code(404); exit; }

function ot_prompts() {
    static $p = null;
    if ($p === null) $p = json_decode(file_get_contents(__DIR__ . '/prompts.json'), true) ?: [];
    return $p;
}

function ot_json_from_text($txt) {
    $txt = preg_replace('/```(?:json)?/i', '', (string) $txt);
    $a = strpos($txt, '{');
    if ($a === false) return null;
    // try the widest {...} first, then shorter endings, so stray braces in trailing prose don't break parsing
    $end = strlen($txt);
    for ($tries = 0; $tries < 6; $tries++) {
        $b = strrpos(substr($txt, 0, $end), '}');
        if ($b === false || $b < $a) break;
        $s = substr($txt, $a, $b - $a + 1);
        $j = json_decode($s, true);
        if (!is_array($j)) $j = json_decode(preg_replace('/,\s*([}\]])/', '$1', $s), true);
        if (is_array($j)) return $j;
        $end = $b;
    }
    return null;
}

function ot_claude_call($model, $system, $user, $max_tokens, $effort = '') {
    $ch = curl_init(ot_cfg('anthropic_base') . 'messages');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT        => 80,
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => ['content-type: application/json', 'anthropic-version: 2023-06-01', 'x-api-key: ' . ot_cfg('anthropic_key')],
        CURLOPT_POSTFIELDS     => json_encode(array_merge(['model' => $model, 'max_tokens' => $max_tokens, 'system' => $system,
                                               'messages' => [['role' => 'user', 'content' => $user]]],
                                               $effort ? ['output_config' => ['effort' => $effort]] : [])),
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);
    $j = $body ? json_decode($body, true) : null;
    return [$code, $j, $err];
}

function ot_ai_task($name, $data, $note = '', $tool = '') {
    $P = ot_prompts();
    if ($name === '' || $name[0] === '_' || !isset($P[$name])) return ['ok' => false, 'error' => 'Unknown AI task'];
    $t = $P[$name];
    $tier = $t['model'] ?? 'fast';
    $model = ot_cfg('models')[$tier] ?? 'claude-haiku-5-5';
    $note = trim(mb_substr((string) $note, 0, 600));
    $user = ($note !== '' ? "Note from the SEO running this: $note\n\n" : '') . "Data:\n" . json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (strlen($user) > 80000) return ['ok' => false, 'error' => 'Input too large'];
    if (!ot_cfg('anthropic_key')) return ['ok' => false, 'fallback' => true, 'error' => 'No Claude key on the server'];

    $cpath = ot_data_dir('cache') . '/ai-' . sha1($model . $t['system'] . $user) . '.json.php';
    if (is_file($cpath) && time() - filemtime($cpath) < ot_cfg('cache_days') * 86400) {
        $c = ot_read($cpath);
        if ($c) { $c['cached'] = true; $c['cost'] = 0; return $c; }
    }
    $spent = ot_spend('claude');
    if ($spent >= ot_cfg('cap_claude')) return ['ok' => false, 'fallback' => true, 'error' => sprintf('Daily Claude limit reached ($%.2f)', $spent)];

    $t0 = microtime(true); $err = '';
    for ($try = 0; $try < 2; $try++) {
        [$code, $j, $cerr] = ot_claude_call($model, $t['system'], $user, (int) ($t['max_tokens'] ?? 1500), (string) ($t['effort'] ?? ''));
        if ($code === 200 && $j) {
            $txt = '';
            foreach ($j['content'] ?? [] as $blk) if (($blk['type'] ?? '') === 'text') $txt .= $blk['text'];
            $in = $j['usage']['input_tokens'] ?? 0; $out = $j['usage']['output_tokens'] ?? 0;
            [$pi, $po] = ot_cfg('model_price')[$tier] ?? [3, 15];
            $cost = round(($in * $pi + $out * $po) / 1e6, 5);
            ot_spend('claude', $cost);
            $parsed = ot_json_from_text($txt);
            $secs = round(microtime(true) - $t0, 2);
            ot_log(['svc' => 'claude', 'tool' => $tool, 'task' => $name, 'model' => $model, 'in' => $in, 'out' => $out, 'cost' => $cost, 's' => $secs, 'ok' => (bool) $parsed]);
            if ($parsed) {
                $res = ['ok' => true, 'json' => $parsed, 'model' => $model, 'cost' => $cost, 'seconds' => $secs];
                ot_write($cpath, $res);
                return $res;
            }
            $err = 'Claude did not return JSON';
            continue;
        }
        $err = $j['error']['message'] ?? ($cerr ?: "HTTP $code");
        if (!in_array($code, [0, 429, 500, 502, 503, 529], true)) break;   // bad key, no credit, bad request: don't retry
        usleep(1200000);
    }
    ot_log(['svc' => 'claude', 'tool' => $tool, 'task' => $name, 'model' => $model, 'cost' => 0, 'ok' => false, 'err' => mb_substr($err, 0, 200)]);
    return ['ok' => false, 'fallback' => true, 'error' => $err];
}
