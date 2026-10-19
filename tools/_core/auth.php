<?php
/**
 * Who can run live scans and decks.
 *   WordPress: a logged-in administrator. Requests that spend money also carry a WordPress nonce.
 *   No WordPress: the access_password from local-config.php (browser asks once with a login box).
 */
if (!defined('OT_CORE')) { http_response_code(404); exit; }

function ot_is_admin() {
    if ($GLOBALS['OT_WP'] && function_exists('current_user_can')) {
        return is_user_logged_in() && current_user_can('manage_options');
    }
    $pw = ot_cfg('access_password');
    if (!$pw) return false;
    return isset($_SERVER['PHP_AUTH_PW']) && hash_equals($pw, (string) $_SERVER['PHP_AUTH_PW']);
}

function ot_nonce() {
    return ($GLOBALS['OT_WP'] && function_exists('wp_create_nonce')) ? wp_create_nonce('ot_tools') : '';
}

function ot_nonce_ok() {
    if (!($GLOBALS['OT_WP'] && function_exists('wp_verify_nonce'))) return true;
    return (bool) wp_verify_nonce($_SERVER['HTTP_X_OT_NONCE'] ?? '', 'ot_tools');
}

function ot_login_url() {
    if ($GLOBALS['OT_WP'] && function_exists('wp_login_url')) {
        $back = $_SERVER['HTTP_REFERER'] ?? (function_exists('home_url') ? home_url('/tools/') : '/');
        return wp_login_url($back);
    }
    return ot_cfg('access_password') ? 'api.php?a=login' : null;
}
