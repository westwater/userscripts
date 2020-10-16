// ==UserScript==
// @name         [AWS] [Cloudwatch] Link to insights in log group
// @namespace    https://github.com/westwater/userscripts
// @version      0.1
// @description  Adds a button that links to cloudwatch insights when viewing a log group
// @author       George Westwater
// @homepageURL  https://github.com/westwater/userscripts
// @match        https://console.aws.amazon.com/cloudwatch/*
// @require      http://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js
// @require      https://raw.githubusercontent.com/uzairfarooq/arrive/v2.4.1/minified/arrive.min.js
// ==/UserScript==

// initiatilize my specific jQuery and avoid conflicts with aws one
/* globals jQuery: false */
const $j = jQuery.noConflict(true);

$j(function () {
    const pattern = /#logStream:group=([a-zA-Z0-9-/]+)(?:;.*){0,}/
    const insightsButton = '<button type="button" class="gwt-Button GIYU-ANBAMB GIYU-ANBDMB" id="gwt-insights">Insights</button>'

    // initial cloudwatch insights query that is loaded on launch
    // note: '*0a' is the hex character for newline - this is used as aws cannot normalise '\n' in the url
    const initialQuery = 'fields @timestamp, @message*0a| sort @timestamp desc'

    // Cannot @match / @include on url fragments (#) so matching is done here
    if (pattern.test(location.hash)){
         const match = location.hash.match(pattern)
         const logGroup = match[1]

        $j(document).arrive("#gwt-debug-deleteLogStreamButton", function() {
            $j(document).unbindArrive("#gwt-debug-deleteLogStreamButton")
            $j(this).after(insightsButton)
        })

        $j(document).on("click", "#gwt-insights", function() {
            let url = `https://console.aws.amazon.com/cloudwatch/home#logs-insights:queryDetail=~(end~0~start~-3600~timeType~'RELATIVE~unit~'seconds~editorString~'${initialQuery}~isLiveTail~false~source~(~'${logGroup}))`
            location.href = url
        })
    }
});
