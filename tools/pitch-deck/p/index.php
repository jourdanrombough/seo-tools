<?php
// Public deck viewer: prospects open /tools/pitch-deck/p/?id=<token> with no login.
header('X-Robots-Tag: noindex, nofollow');
header('Content-Type: text/html; charset=utf-8');
readfile(__DIR__ . '/viewer.html');
