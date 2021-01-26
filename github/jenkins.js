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

/* globals jQuery, config: false */
const $j = jQuery.noConflict(true)

const building = "https://github.com/westwater/userscripts/raw/main/resources/jenkins/building.gif"
const success = "https://github.com/westwater/userscripts/raw/main/resources/jenkins/success.png"

$j(function () {
    'use strict'

    GM_addStyle(css())

    const orgName = $j("[data-hovercard-type='organization']").text().trim().toLowerCase()
    const repoName = $j("strong[itemprop='name']").text().trim()

    const githubToJenkinsMappings = config.github.jenkinsMappings

    if (orgName in githubToJenkinsMappings) {
        preloadResources()
        const jenkinsBaseUrl = githubToJenkinsMappings[orgName].baseUrl
        const tagReleasePath = githubToJenkinsMappings[orgName].tagReleasePath
        renderJenkinsCreateARelease(jenkinsBaseUrl + tagReleasePath)
        renderJenkinsLinks(jenkinsBaseUrl, orgName, repoName)
    } else {
        console.log(`[Tampermonkey] [Github] Jenkins build info - Github org ${orgName} not supported`)
    }
});

function preloadResources() {
    $j("head")
        .append(`<link rel="preload" href="${building}" as="image">`)
        .append(`<link rel="preload" href="${success}" as="image">`)
}

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
                $j(this).after(`<p id="jenkins-container" style="color: #0366d6">Checking...</p>`)
                renderJenkinsJobProgress(jenkinsBaseUrl, orgName, repoName, version)
                setInterval(function () { renderJenkinsJobProgress(jenkinsBaseUrl, orgName, repoName, version) }, 15000)
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
                    $j("#build-progress").replaceWith(`
                        <div id="jenkins-container">
                            <img class="jenkins-icon" src="${building}">
                            <p id="build-progress" style="color: #fbca04">Building...</p>
                        <\div>`)
                } else {
                    if (build.result == "SUCCESS") {
                        $j("#jenkins-container").replaceWith(`
                        <div id="jenkins-container">
                            <p id="build-progress" style="color: green">
                                Build successful
                            </p>
                            <div class="jenkins-build">
                                <img class="jenkins-icon" src="${success}">
                                <div id="progress-status"> 
                                    <div id="progress-bar"></div> 
                                </div>
                            </div>
                        </div>
                        `)
                    } else if (build.result == "ABORTED") {
                        $j("#build-progress").replaceWith(`
                        <div id="jenkins-container">
                            <p id="build-progress" style="color: grey">Build aborted</p>
                        </div>`)
                    } else {
                        $j("#build-progress").replaceWith(`
                        <div id="jenkins-container">
                            <p id="build-progress" style="color: red">Build failed</p>
                        <\div>`)
                    }
                }
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

function css() {
    return `
       .jenkins-build {
            display: flex;
            justify-content: center;
            top: 50%;
            text-align: center;
        }

        .jenkins-icon {
            width: 24px;
            height: 24px;
        }

        #build-progress {
            display: flex;
            justify-content: center;
            top: 50%;
            text-align: center;
            margin: 0
        }

        #progress-bar {
            width: 20%;
            top: 50%;
            height: 12px;
            background-color: #0366d6;
            text-align: center;
            line-height: 32px;
            color: black;
        }

        #progress-status  {
            display: flex;
            top: 50%;
            margin-top: 5px;
            margin-bottom: 5px;
            width: 70%;
            height: 14px;
            background-color: #fff;
            border: 2px solid;
            border-color: #0366d6;
            float: right;
        }
    `
}