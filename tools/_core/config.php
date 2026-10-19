<?php
/**
 * Optimization Theory SEO tools: shared settings.
 *
 * Keys are read on the server only, from the first place they are found:
 *   1. PHP constants in wp-config.php:  DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD, ANTHROPIC_API_KEY
 *   2. Environment variables with the same names
 *   3. tools/_core/local-config.php (optional, for hosts without WordPress), which returns an array:
 *        <?php return ['dataforseo_login' => '...', 'dataforseo_password' => '...',
 *                      'anthropic_api_key' => '...', 'access_password' => 'pick one'];
 *
 * If your keys already live under other constant names, add those names to the lists below.
 */
if (!defined('OT_CORE')) { http_response_code(404); exit; }

// ---- WordPress (optional): load it so we can check the admin login and read wp-config.php constants
$GLOBALS['OT_WP'] = false;
if (!defined('OT_NO_WP')) {
    for ($up = 1; $up <= 4; $up++) {
        $p = dirname(__DIR__, $up) . '/wp-load.php';
        if (file_exists($p)) { require_once $p; $GLOBALS['OT_WP'] = true; break; }
    }
}

$ot_local = file_exists(__DIR__ . '/local-config.php') ? (include __DIR__ . '/local-config.php') : [];
if (!is_array($ot_local)) $ot_local = [];

function ot_secret(array $names, $fallback = '') {
    foreach ($names as $n) {
        if (defined($n) && constant($n)) return (string) constant($n);
        $e = getenv($n);
        if ($e) return $e;
    }
    return (string) $fallback;
}

$GLOBALS['OT'] = array_replace_recursive([
    // Claude models: fast = keyword checks and labels, smart = business read, plan and deck copy
    'models'          => ['fast' => 'claude-haiku-5-5', 'smart' => 'claude-sonnet-5-5'],
    // rough $ per million tokens (input, output), used for the spend cap and the cost log
    'model_price'     => ['fast' => [1, 5], 'smart' => [3, 15]],
    // backup route when the Claude API fails: Claude through DataForSEO (500-character prompts)
    'fallback_model'  => 'claude-haiku-4-5',
    // daily spend caps in dollars, checked before every call
    'cap_dfs'         => 10,
    'cap_claude'      => 3,
    'cache_days'      => 7,
    'data_dir'        => dirname(__DIR__) . '/_data',
    'dfs_base'        => 'https://api.dataforseo.com/v3/',
    'anthropic_base'  => 'https://api.anthropic.com/v1/',
    'access_password' => '',
], $ot_local);

$GLOBALS['OT']['dfs_login']     = $ot_local['dataforseo_login']    ?? ot_secret(['DATAFORSEO_LOGIN', 'DFS_LOGIN']);
$GLOBALS['OT']['dfs_password']  = $ot_local['dataforseo_password'] ?? ot_secret(['DATAFORSEO_PASSWORD', 'DFS_PASSWORD']);
$GLOBALS['OT']['anthropic_key'] = $ot_local['anthropic_api_key']   ?? ot_secret(['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY']);
if (!$GLOBALS['OT']['access_password']) $GLOBALS['OT']['access_password'] = ot_secret(['OT_TOOLS_PASSWORD']);

function ot_cfg($k, $d = null) { return $GLOBALS['OT'][$k] ?? $d; }
