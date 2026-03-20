/* global chrome */
/**
 * MV3 service worker: loads legacy background logic in an offscreen document
 * so localStorage and DOM-dependent code keep working.
 */
(function () {
	"use strict";

	var OFFSCREEN_PATH = "pages/background/offscreen.html";
	var offscreenCreating = null;

	function getOffscreenUrl() {
		return chrome.runtime.getURL(OFFSCREEN_PATH);
	}

	async function ensureOffscreen() {
		if (typeof chrome.runtime.getContexts === "function") {
			var contexts = await chrome.runtime.getContexts({
				contextTypes: ["OFFSCREEN_DOCUMENT"],
				documentUrls: [getOffscreenUrl()]
			});
			if (contexts && contexts.length) {
				return;
			}
		}
		if (offscreenCreating) {
			await offscreenCreating;
			return;
		}
		offscreenCreating = chrome.offscreen.createDocument({
			url: OFFSCREEN_PATH,
			reasons: ["LOCAL_STORAGE"],
			justification: "KC3 background requires extension localStorage and legacy background scripts."
		});
		try {
			await offscreenCreating;
		} catch (e) {
			var msg = String((e && e.message) || e || "");
			if (msg.indexOf("single") < 0 && msg.indexOf("Offscreen") < 0 && msg.indexOf("offscreen") < 0) {
				throw e;
			}
		} finally {
			offscreenCreating = null;
		}
	}

	chrome.runtime.onInstalled.addListener(function () {
		ensureOffscreen();
	});
	chrome.runtime.onStartup.addListener(function () {
		ensureOffscreen();
	});

	chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
		if (request && request.__kc3BgForward) {
			return false;
		}
		(async function () {
			try {
				await ensureOffscreen();
				var reply = await chrome.runtime.sendMessage({
					__kc3BgForward: true,
					__kc3Payload: request,
					__kc3Sender: {
						tab: sender.tab,
						frameId: sender.frameId,
						id: sender.id,
						url: sender.url,
						origin: sender.origin
					}
				});
				sendResponse(reply);
			} catch (err) {
				sendResponse(undefined);
			}
		})();
		return true;
	});
})();
