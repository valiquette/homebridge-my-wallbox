let axios = require('axios')

let userEndpoint = 'https://user-api.wall-box.com/users'
let endpoint = 'https://api.wall-box.com'

function wallboxAPI (platform,log){
	this.log=log
	this.platform=platform
}

wallboxAPI.prototype={

	checkEmail: async function(email){
		try {  
			this.log.debug('Retrieving device')
			let response = await axios({
					method: 'get',
					url: `${userEndpoint}/emails/${email}`,
					headers: {
						'Content-Type': 'application/json',
					},
					responseType: 'json'
			}).catch(err=>{
				this.log.error('Error checking email %s', JSON.stringify(err.message,null,2))
				this.log.debug(JSON.stringify(err.config,null,2))
			})
			if(response){this.log.debug('check email response',JSON.stringify(response.data,null,2))}
			return response
		}catch(err) {this.log.error('Error checking email %s', err)}
	},

	signin: async function(email,password){
	let b64encoded=(Buffer.from(email+':'+password,'utf8')).toString('base64')
	try {  
			this.log.debug('Retrieving token')
			let response = await axios({
					method: 'get',
					url: `${userEndpoint}/signin`,
					headers: {
						'Content-Type': 'application/json',
						'Authorization': 'Basic '+b64encoded,
						'Origin':'https://my.wallbox.com',
						'Partner':'wallbox',
						'Referer':'https://my.wallbox.com/'
					},
					responseType: 'json'
			}).catch(err=>{
				this.log.error('Error getting token %s', JSON.stringify(err.message,null,2))
				this.log.debug(JSON.stringify(err.config,null,2))
			})
			if(response){this.log.debug('signin response',JSON.stringify(response.data,null,2))}
			return  response
		}catch(err) {this.log.error('Error retrieving token %s', err)}
	},
	
	getId: async function(token,id){
	try {  
			this.log.debug('Retrieving User ID')
			let response = await axios({
					method: 'get',
					url: `${endpoint}/v4/users/${id}/id`,
					headers: {
						'Content-Type': 'application/json',
						'Authorization': 'Bearer '+token
						},
					responseType: 'json'
			}).catch(err=>{
				this.log.error('Error getting ID %s', JSON.stringify(err.message,null,2))
				this.log.debug(JSON.stringify(err.config,null,2))
			})
			if(response){this.log.debug('get ID response',JSON.stringify(response.data,null,2))}
			return response
		}catch(err) {this.log.error('Error retrieving ID %s', err)}
	},

	getUser: async function(token,userId){
		try {  
			this.log.debug('Retrieving user info')
			let response = await axios({
					method: 'get',
					url: `${endpoint}/v2/user/${userId}`,
					headers: {
						'Content-Type': 'application/json',
						'Authorization': 'Bearer '+token
					},
					responseType: 'json'
			}).catch(err=>{
				this.log.error('Error getting user ID %s', JSON.stringify(err.message,null,2))
				this.log.debug(JSON.stringify(err.config,null,2))
			})
			if(response){this.log.debug('get user response',JSON.stringify(response.data,null,2))}
			return response
		}catch(err) {this.log.error('Error retrieving user ID %s', err)}
	},

	getChargerGroups: async function(token){
		try {  
			this.log.debug('Retrieving charger groups')
			let response = await axios({
					method: 'get',
					url: `${endpoint}/v3/chargers/groups`,
					headers: {
						'Content-Type': 'application/json',
						'Authorization': 'Bearer '+token
					},
					responseType: 'json'
			}).catch(err=>{
				this.log.error('Error getting charger groups %s', JSON.stringify(err.message,null,2))
				this.log.debug(JSON.stringify(err.config,null,2))
			})
			if(response){this.log.debug('get charger groups data response',JSON.stringify(response.data,null,2))}
			return response
		}catch(err) {this.log.error('Error retrieving charger groups %s', err)}
	},
	

	getChargerData: async function(token,chargerId){
		try {  
			this.log.debug('Retrieving charger info')
			let response = await axios({
					method: 'get',
					url: `${endpoint}/v2/charger/${chargerId}`,
					headers: {
						'Content-Type': 'application/json',
						'Authorization': 'Bearer '+token
					},
					responseType: 'json'
			}).catch(err=>{
				this.log.error('Error getting charger %s', JSON.stringify(err.message.url,null,2))
				this.log.debug(JSON.stringify(err.config,null,2))
			})
			if(response){this.log.debug('get charger data response',JSON.stringify(response.data,null,2))}
			return response
		}catch(err) {this.log.error('Error retrieving charger %s', err)}
	},
	
	getChargerConfig: async function(token,chargerId){
		try {  
			this.log.debug('Retrieving charger config')
			let response = await axios({
					method: 'get',
					url: `${endpoint}/chargers/config/${chargerId}`,
					headers: {
						'Content-Type': 'application/json',
						'Authorization': 'Bearer '+token
					},
					responseType: 'json'
			}).catch(err=>{
				this.log.error('Error getting charger config %s', JSON.stringify(err.message,null,2))
				this.log.debug(JSON.stringify(err.config,null,2))
			})
			if(response){this.log.debug('get charger config response',JSON.stringify(response.data,null,2))}
			return response
		}catch(err) {this.log.error('Error retrieving charger config %s', err)}
	},

	lock: async function(token,chargerId,value){
		try {  
			this.log.debug('Setting charger lock state for %s to %s',chargerId,value)
			let response = await axios({
					method: 'put',
					url: `${endpoint}/v2/charger/${chargerId}`,
					headers: {
						'Content-Type': 'application/json',
						'Authorization': 'Bearer '+token
					},
					data:{
						"locked": value
					},
					responseType: 'json'
			}).catch(err=>{
				this.log.error('Error locking charger config %s', JSON.stringify(err.message,null,2))
				this.log.debug(JSON.stringify(err.config,null,2))
			})
			if(response){this.log.debug('put lock response',response.status)}
			return response
		}catch(err) {this.log.error('Error setting lock state config %s', err)}
	},

	setAmps: async function(token,chargerId,value){
		try {  
			this.log.debug('Setting amperage for %s to %s',chargerId,value)
			let response = await axios({
					method: 'put',
					url: `${endpoint}/v2/charger/${chargerId}`,
					headers: {
						'Content-Type': 'application/json',
						'Authorization': 'Bearer '+token
					},
					data:{
						"maxChargingCurrent": value
					},
					responseType: 'json'
			}).catch(err=>{
				this.log.error('Error setting amperage %s', JSON.stringify(err.message,null,2))
				this.log.debug(JSON.stringify(err.config,null,2))
			})
			if(response){this.log.debug('put setAmps response',response.status)}
			return response
		}catch(err) {this.log.error('Error setting amperage %s', err)}
	},

	remoteAction: async function(token,chargerId,value){
		try {  
			this.log.debug('Setting charging state for %s to %s',chargerId,value)
			let action
			switch(value){
				case "start":
					action=1
					break
				case "pause":
					action=2
				break
			}
			let response = await axios({
					method: 'post',
					url: `${endpoint}/v3/chargers/${chargerId}/remote-action`,
					headers: {
						'Content-Type': 'application/json',
						'Authorization': 'Bearer '+token
					},
					data:{
						"action": action
					},
					responseType: 'json'
			}).catch(err=>{
				this.log.error('Error locking charger config %s', JSON.stringify(err.message,null,2))
				this.log.debug(JSON.stringify(err.config,null,2))
			})
			if(response){this.log.debug('put lock response',response.status)}
			return response
		}catch(err) {this.log.error('Error setting lock state config %s', err)}
	},
}

module.exports = wallboxAPI