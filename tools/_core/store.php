<?php
/**
 * Storage: scans, decks, settings, cache and logs as JSON files in tools/_data/.
 * Every file is saved as .json.php with an exit line first, so even on servers that ignore .htaccess
 * (nginx) a direct request returns nothing.
 */
if (!defined('OT_CORE')) { http_response_code(404); exit; }

const OT_GUARD = "<?php http_response_code(404); exit; ?>\n";
const OT_DIRS = ['cache', 'scans', 'decks', 'public', 'logs', 'settings'];

function ot_data_dir($sub = '') {
    $base = rtrim(ot_cfg('data_dir'), '/');
    static $ready = false;
    if (!$ready) {
        foreach (OT_DIRS as $d) if (!is_dir("$base/$d")) @mkdir("$base/$d", 0750, true);
        if (!file_exists("$base/.htaccess")) @file_put_contents("$base/.htaccess", "Require all denied\nDeny from all\n");
        if (!file_exists("$base/index.html")) @file_put_contents("$base/index.html", "");
        $ready = true;
    }
    return $sub === '' ? $base : "$base/$sub";
}

function ot_safe_id($id) { return (bool) preg_match('/^[a-z0-9][a-z0-9\-]{0,150}$/', (string) $id); }

function ot_write($path, $data) {
    $tmp = $path . '.tmp' . getmypid();
    $ok = @file_put_contents($tmp, OT_GUARD . json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)) !== false;
    return $ok && @rename($tmp, $path);
}

function ot_read($path) {
    if (!is_file($path)) return null;
    $s = file_get_contents($path);
    if (strncmp($s, '<?php', 5) === 0) $s = substr($s, strpos($s, "\n") + 1);
    $j = json_decode($s, true);
    return is_array($j) ? $j : null;
}

function ot_file($kind, $id) {
    if (!in_array($kind, ['scans', 'decks', 'public', 'settings'], true) || !ot_safe_id($id)) return null;
    return ot_data_dir($kind) . '/' . $id . '.json.php';
}

function ot_rand($bytes) { return bin2hex(random_bytes($bytes)); }

function ot_slug($s, $max = 70) {
    return substr(trim(preg_replace('/[^a-z0-9]+/', '-', strtolower((string) $s)), '-'), 0, $max);
}

/** Short summaries for the history lists. */
function ot_list($kind, $limit = 60) {
    $files = glob(ot_data_dir($kind) . '/*.json.php') ?: [];
    usort($files, function ($a, $b) { return filemtime($b) - filemtime($a); });
    $out = [];
    foreach (array_slice($files, 0, $limit) as $f) {
        $d = ot_read($f);
        if (!$d) continue;
        $id = basename($f, '.json.php');
        if ($kind === 'scans') {
            $out[] = ['id' => $id, 'domain' => $d['domain'] ?? '', 'keyword' => $d['keyword'] ?? '', 'note' => $d['note'] ?? '',
                      'location' => $d['location']['label'] ?? '', 'region' => $d['location']['abbr'] ?? '',
                      'date' => $d['date'] ?? '', 'headline' => $d['headline'] ?? ''];
        } else {
            $out[] = ['id' => $id, 'domain' => $d['input']['domain'] ?? '', 'business' => $d['input']['business'] ?? '',
                      'date' => $d['updated'] ?? ($d['created'] ?? ''), 'status' => $d['status'] ?? 'draft',
                      'token' => $d['token'] ?? null, 'headline' => $d['headline'] ?? ''];
        }
    }
    return $out;
}

/** Spend tracking per service per day, with a lock so parallel calls add up correctly. */
function ot_spend($service, $add = 0.0) {
    $f = ot_data_dir('logs') . '/spend-' . date('Y-m-d') . '.json.php';
    $h = fopen($f, 'c+');
    if (!$h) return 0.0;
    flock($h, LOCK_EX);
    $s = stream_get_contents($h);
    if (strncmp($s, '<?php', 5) === 0) $s = substr($s, strpos($s, "\n") + 1);
    $d = json_decode($s, true) ?: [];
    if ($add > 0) {
        $d[$service] = round(($d[$service] ?? 0) + $add, 5);
        ftruncate($h, 0); rewind($h);
        fwrite($h, OT_GUARD . json_encode($d));
    }
    flock($h, LOCK_UN); fclose($h);
    return (float) ($d[$service] ?? 0);
}

function ot_log($row) {
    $f = ot_data_dir('logs') . '/calls-' . date('Y-m') . '.log.php';
    if (!file_exists($f)) @file_put_contents($f, OT_GUARD);
    $row['t'] = date('c');
    @file_put_contents($f, json_encode($row, JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);
}
