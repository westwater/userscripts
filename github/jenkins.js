// ==UserScript==
// @name         [Github] Jenkins build info
// @namespace    https://github.com/westwater
// @version      0.2
// @description  Enriches a Github repo with jenkins links and build info (note: Jenkins instance must be using the workflow multibranch plugin)
// @author       George Westwater
// @icon         https://github.githubassets.com/pinned-octocat.svg
// @include      /^http[s]{0,1}:\/\/.*github.*\/releases$/
// @require      http://ajax.googleapis.com/ajax/libs/jquery/3.4.1/jquery.min.js
// @require      file:///Users/georgewestwater/vault/.userscript.conf.js
// @require      file:///Users/georgewestwater/userscripts/github/jenkins.js
// @grant        GM_xmlhttpRequest
// ==/UserScript==

// todo: on `Building...`, show elapsed time and estimated time left

/* globals jQuery, config: false */
const $j = jQuery.noConflict(true)

$j(function () {
    'use strict'

    const orgName = $j("[data-hovercard-type='organization']").text().trim().toLowerCase()
    const repoName = $j("strong[itemprop='name']").text().trim()

    const githubToJenkinsMappings = config.github.jenkinsMappings

    if (orgName in githubToJenkinsMappings) {
        const jenkinsBaseUrl = githubToJenkinsMappings[orgName].baseUrl
        const tagReleasePath = githubToJenkinsMappings[orgName].tagReleasePath
        renderJenkinsCreateARelease(jenkinsBaseUrl + tagReleasePath)
        renderJenkinsLinks(jenkinsBaseUrl, orgName, repoName)
    } else {
        console.log(`[Tampermonkey] [Github] Jenkins build info - Github org ${orgName} not supported`)
    }
});

function renderJenkinsCreateARelease(tagReleaseUrl) {
    $j(".float-right.hide-sm").each(function () {
        const style = "color: #0366d6; border-color: #0366d6;"
        $j(this).prepend(`<a href="${tagReleaseUrl}" class="btn" style="${style}">Create a release on Jenkins</a>`)
    })
}

function renderJenkinsLinks(jenkinsBaseUrl, orgName, repoName) {
    $j("li.d-block.mb-1").each(function (index) {
        const version = $j(this).find("a.muted-link.css-truncate").first().attr("title")

        if (version !== undefined) {
            const jenkinsUrl = `${jenkinsBaseUrl}/job/${orgName}/job/${repoName}/view/tags/job/${version}`
            $j(this).after(`<a href="${jenkinsUrl}">Jenkins build </a>`)

            // Only check Jenkins for the latest git release
            if (index == 0) {
                $j(this).after(`<p id="checking" style="color: #0366d6">Checking...</p>`)
                const url = `${jenkinsBaseUrl}/job/${orgName}/job/${repoName}/view/tags/job/${version}/api/json?tree=builds[url]`

                httpGet(url, function (response) {
                    console.log(response.responseText)
                    const json = JSON.parse(response.responseText)
                    if (json.builds.length != 0) {
                        const buildUrl = `${json.builds[0].url}/api/json?tree=building,result`

                        httpGet(buildUrl, function (buildResponse) {
                            const build = JSON.parse(buildResponse.responseText)
                            if (build.building) {
                                $j("#checking").html('<p style="color: #fbca04">Building...</p>')
                            } else {
                                if (build.result == "SUCCESS") {
                                    $j("#checking").html('<p style="color: green">Build successful</p>')
                                } else {
                                    $j("#checking").html('<p style="color: red">Build failed</p>')
                                }
                            }
                        })
                    } else {
                        console.log("no builds yet")
                    }
                })
            }
        }
    });
}

// jenkins specific http GET
function httpGet(url, onResponse) {
    console.log("Requesting GET " + url)

    GM_xmlhttpRequest({
        method: "GET",
        url: url,
        headers: {
            "Accept": "application/json",
            "Authorization": `Basic ${btoa(config.jenkins.user + ":" + config.jenkins.apiKey)}`
        },
        onload: onResponse
    });
}