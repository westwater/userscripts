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
// @resource     loading https://github.com/westwater/userscripts/raw/main/resources/jenkins/building.gif
// @grant        GM_xmlhttpRequest
// @grant        GM_getResourceText
// ==/UserScript==

// todo: on `Building...`, show elapsed time and estimated time left

/* globals jQuery, config: false */
const $j = jQuery.noConflict(true)

const building = "https://github.com/westwater/userscripts/raw/main/resources/jenkins/building.gif"

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
                $j(this).after(`<p id="build-progress" style="color: #0366d6">Checking...</p>`)
                renderJenkinsJobProgress(jenkinsBaseUrl, orgName, repoName, version)
                setInterval(function () { renderJenkinsJobProgress(jenkinsBaseUrl, orgName, repoName, version) }, 150000)
            }
        }
    });
}

function renderJenkinsJobProgress(jenkinsBaseUrl, orgName, repoName, version) {
    const url = `${jenkinsBaseUrl}/job/${orgName}/job/${repoName}/view/tags/job/${version}/api/json?tree=builds[url]`

    httpGet(url, function (response) {
        const json = JSON.parse(response.responseText)
        if (json.builds !== undefined && json.builds.length != 0) {
            const buildUrl = `${json.builds[0].url}/api/json?tree=building,result`

            httpGet(buildUrl, function (buildResponse) {
                const build = JSON.parse(buildResponse.responseText)
                if (build.building) {
                    $j("#build-progress").replaceWith(`<img src="${building}"><p id="build-progress" style="color: #fbca04">Building...</p>`)
                } else {
                    if (build.result == "SUCCESS") {
                        $j("#build-progress").replaceWith(`<p id="build-progress" style="color: green"><img width="24" src="${building}">Build successful</p>`)
                    } else if (build.result == "ABORTED") {
                        $j("#build-progress").replaceWith('<p id="build-progress" style="color: grey">Build aborted</p>')
                    } else {
                        $j("#build-progress").replaceWith('<p id="build-progress" style="color: red">Build failed</p>')
                    }
                }

                $j("#build-progress").css({
                    display: "flex",
                    "justify-content": "center",
                    top: "50%",
                    "text-align": "center",
                    margin: 0
                });
            })
        } else {
            console.log("no builds yet")
        }
    })
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