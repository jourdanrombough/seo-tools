<?php
/**
 * One API for both tools. Each tool's api.php sets OT_TOOL and includes this file.
 *   api.php?a=health                 anyone   live mode on/off, login link, nonce
 *   api.php?a=dfs        POST        admin    one allowlisted DataForSEO call
 *   api.php?a=ai         POST        admin    one named AI task
 *   api.php?a=save       POST        admin    save a scan or deck
 *   api.php?a=list&kind=scans|decks  admin    history
 *   api.php?a=get&kind=..&id=..      admin    one saved scan or deck
 *   api.php?a=rates      GET/POST    admin    the rate card
 *   api.php?a=publish    POST        admin    make a deck viewable at its private link
 *   api.php?a=unpublish  POST        admin
 *   api.php?a=deck&id=TOKEN          anyone with the token
 *   api.php?a=balance                admin    DataForSEO balance
 */
define('OT_CORE', 1);
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/store.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/dfs.php';
require_once __DIR__ . '/claude.php';

@set_time_limit(100);

function ot_out($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Robots-Tag: noindex');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}
function ot_body() {
    static $b = null;
    if ($b === null) { $raw = file_get_contents('php://input'); if (strlen($raw) > 12e6) ot_out(['error' => 'Too large'], 413); $b = json_decode($raw, true) ?: []; }
    return $b;
}

$tool  = defined('OT_TOOL') ? OT_TOOL : '';
$a     = $_GET['a'] ?? '';
$post  = ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';
$admin = ot_is_admin();

// ---------- public actions
if ($a === 'health') {
    $keys = ['dataforseo' => (bool) (ot_cfg('dfs_login') && ot_cfg('dfs_password')), 'claude' => (bool) ot_cfg('anthropic_key')];
    $out = ['ok' => true, 'tool' => $tool, 'mode' => ($admin && $keys['dataforseo']) ? 'local' : 'demo', 'host' => $GLOBALS['OT_WP'] ? 'wordpress' : 'php', 'keys' => $keys];
    if ($admin) {
        $out['nonce'] = ot_nonce();
        $out['models'] = ot_cfg('models');
        $out['spent'] = ['dfs' => ot_spend('dfs'), 'claude' => ot_spend('claude'), 'cap_dfs' => ot_cfg('cap_dfs'), 'cap_claude' => ot_cfg('cap_claude')];
    } else {
        $out['login'] = ot_login_url();
    }
    ot_out($out);
}
if ($a === 'login') {
    if (!$admin) { header('WWW-Authenticate: Basic realm="SEO tools"'); ot_out(['error' => 'Password required'], 401); }
    header('Location: ./'); exit;
}
if ($a === 'deck') {
    $tok = (string) ($_GET['id'] ?? '');
    if (!preg_match('/^[a-f0-9]{32}$/', $tok)) ot_out(['error' => 'not found'], 404);
    $d = ot_read(ot_file('public', $tok));
    if (!$d) ot_out(['error' => 'not found'], 404);
    if (!empty($d['expires']) && strtotime($d['expires']) < time()) ot_out(['error' => 'This link has expired'], 410);
    ot_out($d);
}

// ---------- admin only from here
if (!$admin) {
    if (!$GLOBALS['OT_WP'] && ot_cfg('access_password')) header('WWW-Authenticate: Basic realm="SEO tools"');
    ot_out(['error' => 'Log in to run live tools', 'login' => ot_login_url()], 401);
}
if ($post && !ot_nonce_ok()) ot_out(['error' => 'Your session expired. Reload the page.'], 403);

switch ($a) {
    case 'balance':
        $r = ot_dfs_raw('appendix/user_data');
        ot_out(['balance' => $r['result'][0]['money']['balance'] ?? null]);

    case 'dfs':
        $b = ot_body();
        ot_out(ot_dfs((string) ($b['endpoint'] ?? ''), $b['task'] ?? [], !empty($b['fresh']), $tool));

    case 'ai':
        $b = ot_body();
        ot_out(ot_ai_task((string) ($b['task'] ?? ''), $b['data'] ?? [], (string) ($b['note'] ?? ''), $tool));

    case 'save':
        $b = ot_body();
        $kind = $b['kind'] ?? 'scans';
        $d = $b['data'] ?? null;
        if (!in_array($kind, ['scans', 'decks'], true) || !is_array($d)) ot_out(['error' => 'Bad save'], 400);
        $id = $b['id'] ?? '';
        if (!$id || !ot_safe_id($id)) {
            $id = $kind === 'scans'
                ? date('Ymd-Hi') . '-' . ot_slug(($d['domain'] ?? 'scan') . '-' . (($d['keyword'] ?? '') ?: 'site') . '-' . ($d['location']['abbr'] ?? ($d['location']['label'] ?? ''))) . '-' . ot_rand(3)
                : date('Ymd') . '-' . ot_slug($d['input']['domain'] ?? 'deck', 40) . '-' . ot_rand(4);
        }
        if ($kind === 'decks') { $old = ot_read(ot_file('decks', $id)); if ($old && !empty($old['token']) && empty($d['token'])) $d['token'] = $old['token']; $d['updated'] = date('c'); }
        if (!ot_write(ot_file($kind, $id), $d)) ot_out(['error' => 'Could not write to tools/_data. Check folder permissions.'], 500);
        ot_out(['id' => $id, 'token' => $d['token'] ?? null]);

    case 'list':
        $kind = $_GET['kind'] ?? 'scans';
        if (!in_array($kind, ['scans', 'decks'], true)) ot_out(['error' => 'bad kind'], 400);
        ot_out(ot_list($kind));

    case 'get':
        $kind = $_GET['kind'] ?? 'scans';
        $f = in_array($kind, ['scans', 'decks'], true) ? ot_file($kind, $_GET['id'] ?? '') : null;
        $d = $f ? ot_read($f) : null;
        if (!$d) ot_out(['error' => 'not found'], 404);
        ot_out($d);

    case 'rates':
        $f = ot_file('settings', 'rates');
        if ($post) { $b = ot_body(); if (!is_array($b['rates'] ?? null)) ot_out(['error' => 'Bad rate card'], 400); ot_write($f, $b['rates']); ot_out(['ok' => true]); }
        ot_out(['rates' => ot_read($f)]);

    case 'publish':
        $b = ot_body();
        $f = ot_file('decks', $b['id'] ?? '');
        $d = $f ? ot_read($f) : null;
        if (!$d || empty($d['view'])) ot_out(['error' => 'Deck not found or not built yet'], 404);
        $tok = (!empty($d['token']) && preg_match('/^[a-f0-9]{32}$/', $d['token'])) ? $d['token'] : ot_rand(16);
        $pub = $d['view'];
        $pub['published'] = date('c');
        $pub['expires'] = !empty($b['expires']) ? date('c', strtotime($b['expires'])) : null;
        ot_write(ot_file('public', $tok), $pub);
        $d['token'] = $tok; $d['status'] = 'published'; $d['published'] = $pub['published']; $d['expires'] = $pub['expires'];
        ot_write($f, $d);
        ot_out(['token' => $tok]);

    case 'unpublish':
        $b = ot_body();
        $f = ot_file('decks', $b['id'] ?? '');
        $d = $f ? ot_read($f) : null;
        if (!$d) ot_out(['error' => 'not found'], 404);
        if (!empty($d['token'])) @unlink(ot_file('public', $d['token']));
        $d['status'] = 'draft';
        ot_write($f, $d);
        ot_out(['ok' => true]);
}
ot_out(['error' => 'Unknown action'], 404);
