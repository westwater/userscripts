// multibranch functions require the targeted jenkins instance to use workflow multibranch plugin
const multibranch = {

    // returns: { builds: [{url: buildUrl, number: buildNumber}] }
    async getJob(jobUrl) {
        const jobApiUrl = `${jobUrl}/api/json?tree=builds[url,number]`
        const response = await Jenkins.http.get(jobApiUrl)
        console.log(response.responseText)
        const json = JSON.parse(response.responseText)
        const jobBuilds = json.builds !== undefined ? json.builds : []
        return builds = {
            builds: jobBuilds
        }
    },
    // returns: { timestamp: buildStartTime (millis), building: isBuilding (boolean), result: buildResult}
    async getBuild(buildUrl) {
        const buildApiUrl = `${buildUrl}/api/json?tree=building,result,timestamp`
        const response = await Jenkins.http.get(buildApiUrl)
        const json = JSON.parse(response.responseText)
        return {
            timestamp: json.timestamp,
            building: json.building,
            result: json.result
        }
    },
    // returns: see getBuild
    async getLatestBuild(jobUrl) {
        const job = await Jenkins.multibranch.getJob(jobUrl)
        if(job.builds && job.builds.length != 0){
            return await Jenkins.multibranch.getBuild(job.builds[0].url)
        } else {
            return {}
        }
    }
}

const http = {
    get(url) {
        console.log("Requesting GET " + url)
        return new Promise((resolve, reject) => GM_xmlhttpRequest({
            method: "GET",
            url: url,
            headers: {
                "Accept": "application/json",
                "Authorization": `Basic ${btoa(config.jenkins.user + ":" + config.jenkins.apiKey)}`
            },
            onload: function(response){
                resolve(response)
            },
            onerror: function(response){
                reject(response)
            }
        }))
    }
}

const Jenkins = {
    icons: {
        building: "https://github.com/westwater/userscripts/raw/main/resources/jenkins/building_green.gif",
        success: "https://github.com/westwater/userscripts/raw/main/resources/jenkins/success.png",
        aborted: "https://github.com/westwater/userscripts/raw/main/resources/jenkins/aborted.png"
    },
    multibranch: multibranch,
    http: http
}
