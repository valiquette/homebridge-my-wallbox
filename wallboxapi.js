let axios = require('axios')

let userEndpoint = 'https://user-api.wall-box.com/users'
let endpoint = 'https://api.wall-box.com'

function wallboxAPI (platform,log){
	this.log=log
	this.platform=platform
}

wallboxAPI.prototype={

	checkEmail: async function(email){
		this.platform.apiCount++
		try {
			this.log.debug('Retrieving device')
			let response = await axios({
					method: 'get',
					baseURL:userEndpoint,
					url: `/emails/${email}`,
					headers: {
						'Content-Type': 'application/json',
						'User-Agent': `${PluginName}/${PluginVersion}`
					},
					responseType: 'json'
			}).catch(err=>{
				this.log.debug(JSON.stringify(err,null,2))
				this.log.error('Error checking email %s', err.message)
				if(err.response){this.log.warn(JSON.stringify(err.response.data,null,2))}
			})
			if(response){this.log.debug('check email response',JSON.stringify(response.data,null,2))}
			return response
		}catch(err) {this.log.error('Error checking email %s', err)}
	},

	signin: async function(email,password){
		this.platform.apiCount++
		let b64encoded=(Buffer.from(email+':'+password,'utf8')).toString('base64')
		try {
			this.log.debug('Retrieving token')
			let response = await axios({
					method: 'get',
					baseURL:userEndpoint,
					url: `/signin`,
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Basic ${b64encoded}`,
						'Partner': 'wallbox',
						'User-Agent': `${PluginName}/${PluginVersion}`
					},
					responseType: 'json'
			}).catch(err=>{
				this.log.debug(JSON.stringify(err,null,2))
				this.log.error('Error getting token %s', err.message)
				if(err.response){this.log.warn(JSON.stringify(err.response.data,null,2))}
			})
			if(response){this.log.debug('signin response',JSON.stringify(response.data,null,2))}
			return  response
		}catch(err) {this.log.error('Error retrieving token %s', err)}
	},

	getId: async function(token,id){
		this.platform.apiCount++
		try {
			this.log.debug('Retrieving User ID')
			let response = await axios({
					method: 'get',
					baseURL:endpoint,
					url: `/v4/users/${id}/id`,
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${token}`,
						'User-Agent': `${PluginName}/${PluginVersion}`
						},
					responseType: 'json'
			}).catch(err=>{
				this.log.debug(JSON.stringify(err,null,2))
				this.log.error('Error getting ID %s', err.message)
				if(err.response){this.log.warn(JSON.stringify(err.response.data,null,2))}
			})
			if(response){this.log.debug('get ID response',JSON.stringify(response.data,null,2))}
			return response
		}catch(err) {this.log.error('Error retrieving ID %s', err)}
	},

	getUser: async function(token,userId){
		this.platform.apiCount++
		try {
			this.log.debug('Retrieving user info')
			let response = await axios({
					method: 'get',
					baseURL:endpoint,
					url: `/v2/user/${userId}`,
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${token}`,
						'User-Agent': `${PluginName}/${PluginVersion}`
					},
					responseType: 'json'
			}).catch(err=>{
				this.log.debug(JSON.stringify(err,null,2))
				this.log.error('Error getting user ID %s', err.message)
				if(err.response){this.log.warn(JSON.stringify(err.response.data,null,2))}
			})
			if(response){this.log.debug('get user response',JSON.stringify(response.data,null,2))}
			return response
		}catch(err) {this.log.error('Error retrieving user ID %s', err)}
	},

	getChargerGroups: async function(token){
		this.platform.apiCount++
		try {
			this.log.debug('Retrieving charger groups')
			let response = await axios({
					method: 'get',
					baseURL:endpoint,
					url: `/v3/chargers/groups`,
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${token}`,
						'User-Agent': `${PluginName}/${PluginVersion}`
					},
					responseType: 'json'
			}).catch(err=>{
				this.log.debug(JSON.stringify(err,null,2))
				this.log.error('Error getting charger groups %s', err.message)
				if(err.response){this.log.warn(JSON.stringify(err.response.data,null,2))}
			})
			if(response){this.log.debug('get charger groups data response',JSON.stringify(response.data,null,2))}
			return response
		}catch(err) {this.log.error('Error retrieving charger groups %s', err)}
	},

	getChargerStatus: async function(token,chargerId){
		this.platform.apiCount++
		try {
			this.log.debug('Retrieving charger status')
			let response = await axios({
					method: 'get',
					baseURL:endpoint,
					url: `/chargers/status/${chargerId}`,
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${token}`,
						'User-Agent': `${PluginName}/${PluginVersion}`
					},
					responseType: 'json'
			}).catch(err=>{
				this.log.debug(JSON.stringify(err,null,2))
				this.log.error('Error getting charger status %s', err.message)
				if(err.response){this.log.warn(JSON.stringify(err.response.data,null,2))}
			})
			//if(response){this.log.debug('get charger status response',JSON.stringify(response.data,null,2))}
			return response
		}catch(err) {this.log.error('Error retrieving charger status %s', err)}
	},

	getChargerData: async function(token,chargerId){
		this.platform.apiCount++
		try {
			this.log.debug('Retrieving charger data')
			let response = await axios({
					method: 'get',
					baseURL:endpoint,
					url: `/v2/charger/${chargerId}`,
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${token}`,
						'User-Agent': `${PluginName}/${PluginVersion}`
					},
					responseType: 'json'
			}).catch(err=>{
				this.log.debug(JSON.stringify(err,null,2))
				this.log.error('Error getting charger data %s', err.message)
				if(err.response){this.log.warn(JSON.stringify(err.response.data,null,2))}
			})
			if(response){this.log.debug('get charger data response',JSON.stringify(response.data.data.chargerData,null,2))}
			return response
		}catch(err) {this.log.error('Error retrieving charger data %s', err)}
	},

	getChargerConfig: async function(token,chargerId){
		this.platform.apiCount++
		try {
			this.log.debug('Retrieving charger config')
			let response = await axios({
					method: 'get',
					baseURL:endpoint,
					url: `/chargers/config/${chargerId}`,
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${token}`,
						'User-Agent': `${PluginName}/${PluginVersion}`
					},
					responseType: 'json'
			}).catch(err=>{
				this.log.debug(JSON.stringify(err,null,2))
				this.log.error('Error getting charger config %s', err.message)
				if(err.response){this.log.warn(JSON.stringify(err.response.data,null,2))}
			})
			if(response){this.log.debug('get charger config response',JSON.stringify(response.data,null,2))}
			return response
		}catch(err) {this.log.error('Error retrieving charger config %s', err)}
	},

	getLastSession: async function(token,chargerId){
		this.platform.apiCount++
		try {
			this.log.debug('Retrieving charger session')
			let response = await axios({
					method: 'get',
					baseURL:endpoint,
					url: `v4/charger-last-sessions`,
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${token}`,
						'User-Agent': `${PluginName}/${PluginVersion}`
					},
					responseType: 'json'
			}).catch(err=>{
				this.log.debug(JSON.stringify(err,null,2))
				this.log.error('Error getting charger session %s', err.message)
				if(err.response){this.log.warn(JSON.stringify(err.response.data,null,2))}
			})
			if(response){this.log.debug('get charger session response',JSON.stringify(response.data,null,2))}
			return response
		}catch(err) {this.log.error('Error retrieving charger session %s', err)}
	},

	lock: async function(token,chargerId,value){
		this.platform.apiCount++
		try {
			this.log.debug('Setting charger lock state for %s to %s',chargerId,value)
			let response = await axios({
					method: 'put',
					baseURL:endpoint,
					url: `/v2/charger/${chargerId}`,
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${token}`,
						'User-Agent': `${PluginName}/${PluginVersion}`
					},
					data:{
						"locked": value
					},
					responseType: 'json'
			}).catch(err=>{
				this.log.debug(JSON.stringify(err,null,2))
				this.log.error('Error locking charger config %s', err.message)
				if(err.response){this.log.warn(JSON.stringify(err.response.data,null,2))}
			})
			if(response){this.log.debug('put lock response',response.status)}
			return response
		}catch(err) {this.log.error('Error setting lock state config %s', err)}
	},

	setAmps: async function(token,chargerId,value){
		this.platform.apiCount++
		try {
			this.log.debug('Setting amperage for %s to %s',chargerId,value)
			let response = await axios({
					method: 'put',
					baseURL:endpoint,
					url: `/v2/charger/${chargerId}`,
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${token}`,
						'User-Agent': `${PluginName}/${PluginVersion}`
					},
					data:{
						"maxChargingCurrent": value
					},
					responseType: 'json'
			}).catch(err=>{
				this.log.debug(JSON.stringify(err,null,2))
				this.log.error('Error setting amperage %s', err.message)
				if(err.response){this.log.warn(JSON.stringify(err.response.data,null,2))}
			})
			if(response){this.log.debug('put setAmps response',response.status)}
			if(response){this.log.debug('put setAmps response {maxChargingCurrent:%s}',JSON.stringify(response.data.data.chargerData.maxChargingCurrent,null,2))}
			return response
		}catch(err) {this.log.error('Error setting amperage %s', err)}
	},

	remoteAction: async function(token,chargerId,value){
		this.platform.apiCount++
		try {
			this.log.debug('Setting charging state for %s to %s',chargerId,value)
			let action
			switch(value){
				case "resume":
				case "start":
					action=1
					break
				case "pause":
					action=2
				break
			}
			let response = await axios({
					method: 'post',
					baseURL:endpoint,
					url: `/v3/chargers/${chargerId}/remote-action`,
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${token}`,
						'User-Agent': `${PluginName}/${PluginVersion}`
					},
					data:{
						"action": action
					},
					responseType: 'json'
			}).catch(err=>{
				this.log.debug(JSON.stringify(err,null,2))
				this.log.error('Error with remote action %s', err.message)
				if(err.response){this.log.warn(JSON.stringify(err.response.data,null,2))}
				return(err.response)
			})
			if(response){this.log.debug('post remote action response',response.status)}
			if(response){this.log.debug('post remote action response',JSON.stringify(response.data,null,2))}
			return response
		}catch(err) {this.log.error('Error with remote action %s', err)}
	},
}

module.exports = wallboxAPI
