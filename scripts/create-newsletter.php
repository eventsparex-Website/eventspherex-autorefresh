<?php
/**
 * EventSphereX Newsletter Auto-Creator
 * Creates a Kit.com broadcast draft with latest article content
 * Run via cron every Tuesday at 8:30 AM IST
 */

$KIT_API_SECRET = '5JAuyw3IHSdBszHaFFlS7ee4mr1syR-F_mbOoxMg50Y';
$SCHEDULE_FILE = __DIR__ . '/newsletter-schedule.json';

if (!file_exists($SCHEDULE_FILE)) { echo "ERROR: Schedule file not found\n"; exit(1); }
$schedule = json_decode(file_get_contents($SCHEDULE_FILE), true);

$newsletter = null;
$nlIndex = -1;
foreach ($schedule as $i => $item) {
    if (!$item['sent']) { $newsletter = $item; $nlIndex = $i; break; }
}
if (!$newsletter) { echo "No pending newsletters\n"; exit(0); }

$n = $newsletter;
$issueNum = $n['issue'];

// Build HTML
$extraHtml = '';
foreach ($n['extra_articles'] as $ea) {
    $extraHtml .= '<div style="padding:20px 32px;border-bottom:1px solid #eee">'
        . '<div style="font-size:10px;font-weight:700;color:#b3d237;text-transform:uppercase;margin-bottom:4px">' . $ea['category'] . '</div>'
        . '<a href="' . $ea['url'] . '" style="font-size:15px;font-weight:700;color:#091d1b;text-decoration:none;display:block;margin-bottom:4px">' . $ea['title'] . '</a>'
        . '<div style="font-size:12px;color:#666">' . $ea['excerpt'] . '</div></div>';
}

$content = '<div style="max-width:620px;margin:0 auto;font-family:Arial,sans-serif">'
    // Header
    . '<div style="background:#091d1b;padding:28px 32px;text-align:center">'
    . '<div style="color:#fff;font-size:24px;font-weight:700">eventsphere<span style="color:#b3d237">X</span></div>'
    . '<div style="color:rgba(255,255,255,.5);font-size:12px;margin-top:6px">INDIA\'S EVENT INDUSTRY WEEKLY</div>'
    . '<div style="display:inline-block;background:rgba(179,210,55,.15);color:#b3d237;font-size:11px;font-weight:600;padding:4px 14px;border-radius:20px;margin-top:12px">Issue #' . $issueNum . ' | ' . $n['date'] . '</div></div>'
    // Hero image
    . '<img src="' . $n['article']['image'] . '" alt="' . htmlspecialchars($n['article']['title']) . '" style="width:100%;display:block">'
    // Hero content
    . '<div style="background:#091d1b;padding:24px 32px">'
    . '<div style="display:inline-block;background:#b3d237;color:#091d1b;font-size:10px;font-weight:700;padding:4px 10px;border-radius:4px;text-transform:uppercase;margin-bottom:10px">This Week\'s Feature</div>'
    . '<h1 style="color:#fff;font-size:22px;font-weight:700;line-height:1.3;margin:0 0 8px">' . htmlspecialchars($n['article']['title']) . '</h1>'
    . '<p style="color:rgba(255,255,255,.7);font-size:13px;line-height:1.5;margin:0 0 14px">' . htmlspecialchars($n['article']['excerpt']) . '</p>'
    . '<a href="' . $n['article']['url'] . '" style="display:inline-block;background:#b3d237;color:#091d1b;font-size:13px;font-weight:700;padding:10px 24px;border-radius:8px;text-decoration:none">Read Full Guide &rarr;</a></div>'
    // Stat
    . '<div style="background:#091d1b;padding:24px 32px;text-align:center;border-top:1px solid rgba(255,255,255,.1)">'
    . '<p style="color:#b3d237;font-size:36px;font-weight:800;margin:0">' . $n['stat']['number'] . '</p>'
    . '<p style="color:rgba(255,255,255,.7);font-size:13px;margin:4px 0 0">' . $n['stat']['label'] . '</p></div>'
    // Worth reading
    . '<div style="padding:24px 32px;border-bottom:2px solid #b3d237;font-size:14px;font-weight:700;color:#091d1b;text-transform:uppercase;letter-spacing:2px"><span style="color:#b3d237">&#9679;</span> Worth Reading</div>'
    . $extraHtml
    // Tool spotlight
    . '<div style="background:linear-gradient(135deg,#091d1b,#0d3d39);padding:28px 32px">'
    . '<p style="font-size:10px;font-weight:700;color:#b3d237;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px">Free Tool of the Week</p>'
    . '<h2 style="font-size:18px;font-weight:700;color:#fff;margin:0 0 8px">' . $n['tool']['name'] . '</h2>'
    . '<p style="font-size:13px;color:rgba(255,255,255,.7);line-height:1.5;margin:0 0 16px">' . $n['tool']['description'] . '</p>'
    . '<a href="' . $n['tool']['url'] . '" style="display:inline-block;background:#b3d237;color:#091d1b;font-size:13px;font-weight:700;padding:10px 24px;border-radius:8px;text-decoration:none">Try It Free &rarr;</a></div>'
    // Pro tip
    . '<div style="margin:20px 32px;background:#f8fae8;border-left:4px solid #b3d237;border-radius:0 8px 8px 0;padding:20px">'
    . '<p style="font-size:10px;font-weight:700;color:#b3d237;text-transform:uppercase;letter-spacing:2px;margin:0 0 8px">Pro Tip</p>'
    . '<p style="font-size:14px;color:#091d1b;line-height:1.6;margin:0">' . $n['tip'] . '</p></div>'
    // Job
    . '<div style="margin:20px 32px;border:1px solid #eee;border-radius:12px;padding:20px">'
    . '<p style="font-size:10px;font-weight:700;color:#b3d237;text-transform:uppercase;letter-spacing:2px;margin:0 0 10px">Hiring Now</p>'
    . '<h3 style="font-size:16px;font-weight:700;color:#091d1b;margin:0 0 4px">' . $n['job']['title'] . '</h3>'
    . '<p style="font-size:12px;color:#888;margin:0 0 12px">' . $n['job']['company'] . ' | ' . $n['job']['location'] . ' | ' . $n['job']['salary'] . '</p>'
    . '<a href="https://eventspherex.com/tools/job-board.html" style="display:inline-block;background:#091d1b;color:#b3d237;font-size:12px;font-weight:700;padding:8px 18px;border-radius:6px;text-decoration:none">View on Job Board &rarr;</a></div>'
    // Share
    . '<div style="text-align:center;padding:24px 32px">'
    . '<p style="font-size:14px;color:#091d1b;font-weight:600;margin:0 0 12px">Found this useful? Forward this email to a colleague!</p>'
    . '<a href="https://wa.me/?text=Check%20out%20EventSphereX%20Weekly%20https://eventspherex.com/newsletter/" style="display:inline-block;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:600;text-decoration:none;color:#fff;background:#25D366;margin:4px">WhatsApp</a>'
    . '<a href="https://www.linkedin.com/sharing/share-offsite/?url=https://eventspherex.com/newsletter/" style="display:inline-block;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:600;text-decoration:none;color:#fff;background:#0077B5;margin:4px">LinkedIn</a></div>'
    // Footer
    . '<div style="background:#091d1b;padding:28px 32px;text-align:center">'
    . '<div style="margin-bottom:16px">'
    . '<a href="https://www.linkedin.com/company/eventspherex/" style="color:#fff;text-decoration:none;margin:0 8px;font-size:13px">LinkedIn</a>'
    . '<a href="https://www.instagram.com/event_spherex/" style="color:#fff;text-decoration:none;margin:0 8px;font-size:13px">Instagram</a>'
    . '<a href="https://www.youtube.com/@EventSphereX" style="color:#fff;text-decoration:none;margin:0 8px;font-size:13px">YouTube</a>'
    . '<a href="https://wa.me/918484981833" style="color:#fff;text-decoration:none;margin:0 8px;font-size:13px">WhatsApp</a></div>'
    . '<div style="color:rgba(255,255,255,.3);font-size:11px">&copy; 2026 EventSphereX. India\'s Event Industry Media Portal.</div></div>'
    . '</div>';

// Create broadcast
$ch = curl_init('https://api.convertkit.com/v3/broadcasts');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode([
        'api_secret' => $KIT_API_SECRET,
        'subject' => $n['article']['subject_line'],
        'content' => $content,
        'description' => "EventSphereX Weekly Issue #$issueNum",
        'public' => true
    ]),
    CURLOPT_HTTPHEADER => ['Content-Type: application/json; charset=utf-8'],
    CURLOPT_RETURNTRANSFER => true
]);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$result = json_decode($response, true);

if ($httpCode === 201 && isset($result['broadcast']['id'])) {
    echo "SUCCESS: Broadcast #{$result['broadcast']['id']} created\n";
    echo "Subject: {$n['article']['subject_line']}\n";
    echo "Go to Kit.com > Broadcasts > Preview & Send\n";
    $schedule[$nlIndex]['sent'] = true;
    $schedule[$nlIndex]['broadcast_id'] = $result['broadcast']['id'];
    file_put_contents($SCHEDULE_FILE, json_encode($schedule, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
} else {
    echo "ERROR: HTTP $httpCode\n$response\n";
}
