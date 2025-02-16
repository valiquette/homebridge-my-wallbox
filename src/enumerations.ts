//import type { ambientPlatform } from './wallboxplatform.js';

export class list {
	constructor(
		private readonly platform: any
	) { }

	list(status: any) {
		let list = {
			"items": [
				{
					"status": 0,
					"statusDescription": "DISCONNECTED",
					"text": "Charger not connected to the network",
					"altText": "Netowrk connection failed",
					"mode": "errorMode"
				},
				{
					"status": 4,
					"statusDescription": "COMPLETED",
					"text": "Complete",
					"altText": "",
					"mode": "standbyMode"
				},
				{
					"status": 5,
					"statusDescription": "OFFLINE",
					"text": "Offline",
					"mode": "errorMode"
				},
				{
					"status": 14,
					"statusDescription": "ERROR",
					"text": "Error",
					"altText": "",
					"mode": "errorMode"
				},
				{
					"status": 15,
					"statusDescription": "",
					"text": "Error",
					"altText": "",
					"mode": "errorMode"
				},
				{
					"status": 161,
					"statusDescription": "READY",
					"text": "Waiting for car connection",
					"altText": "Plug your car in",
					"mode": "readyMode"
				},
				{
					"status": 162,
					"statusDescription": "",
					"text": "Ready",
					"altText": "",
					"mode": "readyMode"
				},
				{
					"status": 163,
					"statusDescription": "",
					"text": "Car Disconnected",
					"altText": "",
					"mode": "readyMode"
				},
				{
					"status": 164,
					"statusDescription": "",
					"text": "Waiting",
					"altText": "",
					"mode": "standbyMode"
				},
				{
					"status": 165,
					"statusDescription": "",
					"text": "Locked",
					"altText": "",
					"mode": "lockedMode"
				},
				{
					"status": 166,
					"statusDescription": "",
					"text": "Updating",
					"altText": "",
					"mode": "firmwareUpdate"
				},
				{
					"status": 177,
					"statusDescription": "",
					"text": "Scheduled",
					"altText": "",
					"mode": "standbyMode"
				},
				{
					"status": 178,
					"statusDescription": "PAUSED",
					"text": "Pausing",
					"altText": "",
					"mode": "standbyMode"
				},
				{
					"status": 179,
					"statusDescription": "SCHEDULED",
					"text": "Waiting for next schedule",
					"altText": "Waiting for upcoming schedule to start",
					"mode": "standbyMode"
				},
				{
					"status": 180,
					"statusDescription": "",
					"text": "Waiting for car demand",
					"altText": "",
					"mode": "standbyMode"
				},
				{
					"status": 181,
					"statusDescription": "WAITING",
					"text": "Waiting for car demand",
					"altText": "Waiting for charge request from your car",
					"mode": "standbyMode"
				},
				{
					"status": 182,
					"statusDescription": "PAUSED",
					"text": "Paused by user",
					"altText": "Press play to resume charging",
					"mode": "standbyMode"
				},
				{
					"status": 183,
					"statusDescription": "",
					"text": "Waiting in queue by Power Sharing",
					"altText": "",
					"mode": "standbyMode"
				},
				{
					"status": 184,
					"statusDescription": "",
					"text": "Waiting in queue by Power Sharing",
					"altText": "",
					"mode": "standbyMode"
				},
				{
					"status": 185,
					"statusDescription": "",
					"text": "Waiting in queue by Power Boost",
					"altText": "",
					"mode": "standbyMode"
				},
				{
					"status": 186,
					"statusDescription": "",
					"text": "Waiting in queue by Power Boost",
					"altText": "",
					"mode": "standbyMode"
				},
				{
					"status": 187,
					"statusDescription": "",
					"text": "Waiting MID failed",
					"altText": "",
					"mode": "standbyMode"
				},
				{
					"status": 188,
					"statusDescription": "",
					"text": "Waiting MID safety margin exceeded",
					"altText": "",
					"mode": "standbyMode"
				},
				{
					"status": 189,
					"statusDescription": "",
					"text": "Waiting in queue by Eco-Smart",
					"altText": "",
					"mode": "standbyMode"
				},
				{
					"status": 193,
					"statusDescription": "",
					"text": "Charging",
					"altText": "",
					"mode": "chargingMode"
				},
				{
					"status": 194,
					"statusDescription": "CHARGING",
					"text": "Process started",
					"altText": "Plugged and running!",
					"mode": "chargingMode"
				},
				{
					"status": 195,
					"statusDescription": "",
					"text": "Charging",
					"altText": "",
					"mode": "chargingMode"
				},
				{
					"status": 196,
					"statusDescription": "",
					"text": "Discharging",
					"altText": "",
					"mode": "chargingMode"
				},
				{
					"status": 209,
					"statusDescription": "LOCKED",
					"text": "Unlock the charger to start using it",
					"altText": "Unlock charger to start session",
					"mode": "lockedMode"
				},
				{
					"status": 210,
					"statusDescription": "LOCKED Car Connected",
					"text": "Unlock the charger to start using it",
					"altText": "Unlock charger to start session",
					"mode": "lockedMode"
				}
			]
		}
		return list.items.filter(result => result.status == status)[0]
	}
}