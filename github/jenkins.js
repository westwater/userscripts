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
// @require      file:///Users/georgewestwater/userscripts/lib/jenkins.js
// @require      file:///Users/georgewestwater/userscripts/github/jenkins.js
// @grant        GM_xmlhttpRequest
// ==/UserScript==

// todo: 
// - Poll jenkins for new releases - if browser is behind, refresh
// - Make building progress bar better - Jenkins claculates estimatedDuration based on the average of the last 3 green builds
//                                     - since tags should only be built once, the average should be taken from the previous 3 releases

/* globals jQuery, config: false */
const $j = jQuery.noConflict(true)

const debug = false;

$j(async function () {
    'use strict'

    GM_addStyle(css())

    const orgName = $j("[data-hovercard-type='organization']").text().trim().toLowerCase()
    const repoName = $j("strong[itemprop='name']").text().trim().toLowerCase()

    const githubToJenkinsMappings = config.github.jenkinsMappings

    if (orgName in githubToJenkinsMappings) {
        preloadResources()
        const jenkinsBaseUrl = githubToJenkinsMappings[orgName].baseUrl
        renderJenkinsMasterBuildProgress(jenkinsBaseUrl, orgName, repoName)
        renderJenkinsLinks(jenkinsBaseUrl, orgName, repoName)

        // repo specific
        if (repoName in githubToJenkinsMappings[orgName]) {

            if ("tagReleasePath" in githubToJenkinsMappings[orgName][repoName]) {
                const tagReleasePath = githubToJenkinsMappings[orgName][repoName].tagReleasePath
                renderJenkinsCreateARelease(jenkinsBaseUrl + tagReleasePath)
            }
        }
    } else {
        console.log(`[Tampermonkey] [Github] Jenkins build info - Github org ${orgName} not supported`)
    }
})

function renderJenkinsCreateARelease(tagReleaseUrl) {
    $j(".float-right.hide-sm").each(function () {
        const style = "color: #0366d6; border-color: #0366d6;"
        $j(this).prepend(`<a href="${tagReleaseUrl}" class="btn" style="${style}">Create a release on Jenkins</a>`)
    })
}

async function renderJenkinsMasterBuildProgress(jenkinsBaseUrl, orgName, repoName) {
    const url = `${jenkinsBaseUrl}/job/${orgName}/job/${repoName}/view/tags/job/master`

    const build = await Jenkins.multibranch.getLatestBuild(url)

    if (build) {
        if (build.building) {
            const currentTimeMillis = new Date().valueOf()
            const buildTime = diffTime(build.timestamp, currentTimeMillis)
            $j("div.subnav").after(`
                <div id="master-build" class="jenkins-container">
                    <div>Master</div>
                    <div>Build time: ${buildTime.time}</div>
                    <div class="jenkins-build">
                        <img class="jenkins-icon" src="${Jenkins.icons.building}">
                        <div id="progress-status">
                            <div id="progress-bar"></div> 
                        </div>
                    </div>
                </div>
            `)
        } else {
            if (build.result == "SUCCESS") {
                $j("div.subnav").after(`
                    <div id="master-build" class="jenkins-container">
                        <p>master success</p>
                    </div>
                `)
            } else {
                $j("div.subnav").after(`
                    <div id="master-build" class="jenkins-container">
                        <p>master failed</p>
                    </div>
                `)
            }
        }
        $j("#master-build").on('click', function () {
            location.href = url
        })
    } else {
        console.log(`no master builds found for ${orgName}/${repoName}`)
    }
}

function renderJenkinsLinks(jenkinsBaseUrl, orgName, repoName) {
    $j("li.d-block.mb-1").each(async function (index) {
        const version = $j(this).find("a.muted-link.css-truncate").first().attr("title")

        if (version !== undefined) {
            const jenkinsUrl = `${jenkinsBaseUrl}/job/${orgName}/job/${repoName}/view/tags/job/${version}`
            $j(this).after(`<a href="${jenkinsUrl}">Jenkins build </a>`)

            // Only check Jenkins for the latest git release
            if (index == 0) {
                $j(this).after(`<p id="jenkins-container" style="color: #0366d6">Checking...</p>`)
                await renderJenkinsJobProgress(jenkinsBaseUrl, orgName, repoName, version)
                setInterval(async function () { await renderJenkinsJobProgress(jenkinsBaseUrl, orgName, repoName, version) }, 15000)
            }
        }
    })
}

async function renderJenkinsJobProgress(jenkinsBaseUrl, orgName, repoName, version) {
    const buildUrl = `${jenkinsBaseUrl}/job/${orgName}/job/${repoName}/view/tags/job/${version}`

    const build = await Jenkins.multibranch.getLatestBuild(buildUrl)
    if (build) {
        if (build.building) {
            const currentTimeMillis = new Date().valueOf()
            const buildTime = diffTime(build.timestamp, currentTimeMillis)
            $j("#jenkins-container").replaceWith(`
                        <div id="jenkins-container">
                            <div>Build time: ${buildTime.time}</div>
                            <div class="jenkins-build">
                                <img class="jenkins-icon" src="${Jenkins.icons.building}">
                                <div id="progress-status">
                                    <div id="progress-bar"></div> 
                                </div>
                            </div>
                        </div>`)
            $j("#progress-status").on('click', function () {
                location.href = buildUrl + "console"
            })
            if (build.estimatedDuration === -1) {
                const buildPlus15Mins = build.timestamp + 900000
                const perc = Math.round(build.timestamp / buildPlus15Mins * 100)
                $j("#progress-bar").css({
                    width: `${perc}%`
                })
            } else {
                const estimatedBuildTime = build.timestamp + build.estimatedDuration
                const perc = Math.round(build.timestamp / estimatedBuildTime * 100)
                $j("#progress-bar").css({
                    width: `${perc}%`
                })
            }
        } else {
            if (build.result == "SUCCESS") {
                $j("#jenkins-container").replaceWith(`
                            <div id="jenkins-container">
                                <div class="jenkins-build">
                                    <img class="jenkins-icon" src="${Jenkins.icons.success}">
                                    <p id="build-progress" style="color: green">
                                        Build successful
                                    </p>
                                </div>
                            </div>`)
            } else if (build.result == "ABORTED") {
                $j("#jenkins-container").replaceWith(`
                            <div id="jenkins-container">
                                <div class="jenkins-build">
                                    <img class="jenkins-icon" src="${Jenkins.icons.aborted}">
                                    <p id="build-progress" style="color: grey">
                                        Build aborted
                                    </p>
                                </div>
                            </div>`)
            } else {
                $j("#jenkins-container").replaceWith(`
                            <div id="jenkins-container">
                                <p id="build-progress" style="color: red">Build failed</p>
                            <\div>`)
            }
        }
    } else {
        console.log(`no builds found for ${buildUrl}`)
    }
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

function diffTime(start, end) {
    if (start < end) {
        const diff = new Date(end - start)
        const hours = diff.getUTCHours() > 0 ? `${diff.getUTCHours()}h:` : ""
        const mins = diff.getMinutes() === 0 & hours === 0 ? "" : `${diff.getMinutes()}m:`
        const secs = `${diff.getSeconds()}s`
        return {
            hours: hours,
            mins: mins,
            secs: secs,
            time: hours + mins + secs
        }
    } else {
        throw "diffTime: start needs to be less than end"
    }
}

function preloadResources() {
    $j("head")
        .append(`<link rel="preload" href="${Jenkins.icons.building}" as="image">`)
        .append(`<link rel="preload" href="${Jenkins.icons.success}" as="image">`)
        .append(`<link rel="preload" href="${Jenkins.icons.aborted}" as="image">`)
}

function css() {
    return `
       .jenkins-build {
            display: flex;
            justify-content: center;
            top: 50%;
            text-align: center;
            margin-right: 0;
        }

        .master-build {
            display: flex;
            justify-content: center;
            top: 50%;
            text-align: center;
        }

        #jenkins-container {
            ${(debug) ? "border: 2px solid;" : ""}
            ${(debug) ? "border-color: #0366d6;" : ""}
            color: #586069;
        }

        .jenkins-container {
            ${(debug) ? "border: 2px solid;" : ""}
            ${(debug) ? "border-color: #0366d6;" : ""}
            color: #586069;
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
            cursor: pointer;
        }
    `
}