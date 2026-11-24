window.__ModuleLoader__.load({
	id: "dsh-team-panel",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_dom = require("react-dom");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_store = require("@deepseek-ai/dsh-client-store");
		// src/client/avatars.ts
		/** One assignment write failed (unknown asset, storage error, transport). */
		var AvatarAssignError = class extends Error {
			detail;
			constructor(message, detail) {
				super(message);
				this.name = "AvatarAssignError";
				this.detail = detail;
			}
		};
		const listeners$2 = /* @__PURE__ */ new Set();
		let rpcCounter$2 = 0;
		let snapshot$2 = {
			assignments: {},
			assets: [],
			deletableAssets: [],
			loaded: false
		};
		let inflight$2;
		let operations = Promise.resolve();
		function serialize(run) {
			const next = operations.then(run);
			operations = next.then(() => void 0, () => void 0);
			return next;
		}
		async function refresh() {
			const { deletableAssets = [], ...value } = await call$2("list", {});
			publish$2({
				...value,
				deletableAssets,
				loaded: true
			});
		}
		function publish$2(next) {
			snapshot$2 = next;
			for (const listener of listeners$2) listener();
		}
		/**
		* POST one Connection RPC envelope to the plugin's host namespace.
		* @param method - remote method below `teamPanel/`.
		* @param args - wire arguments record.
		* @returns the ok-case value.
		* @throws {AvatarAssignError} on transport failure or a failed result.
		*/
		async function call$2(method, args) {
			rpcCounter$2 += 1;
			const response = await fetch(`api/teamPanel/${method}`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					type: "client-request",
					rpcId: `team-panel-${rpcCounter$2}`,
					method: `teamPanel/${method}`,
					payload: { args }
				})
			});
			if (!response.ok) throw new AvatarAssignError(`transport failure: HTTP ${response.status}`, String(response.status));
			const result = (await response.json()).result;
			if (result === void 0 || !result.ok) {
				const code = result?.error?.code ?? "teamPanel/transport";
				throw new AvatarAssignError(result?.error?.message ?? code, code);
			}
			return result.value;
		}
		/**
		* Request the current mapping from the host (deduplicated in flight).
		*/
		function loadAvatars() {
			if (inflight$2 !== void 0) return;
			inflight$2 = serialize(refresh).catch(() => {
				publish$2({
					...snapshot$2,
					loaded: true
				});
			}).finally(() => {
				inflight$2 = void 0;
			});
		}
		/**
		* Subscribe hook backing React's `useSyncExternalStore`.
		* @param onStoreChange - React's change callback.
		* @returns the disposer.
		*/
		function subscribe(onStoreChange) {
			listeners$2.add(onStoreChange);
			return () => {
				listeners$2.delete(onStoreChange);
			};
		}
		/** Current snapshot getter for `useSyncExternalStore`. */
		function getSnapshot() {
			return snapshot$2;
		}
		/**
		* Upload one browser-picked image into the host asset directory.
		* @param file - the picked image file.
		* @returns the stored asset name (sanitized server-side).
		* @throws {AvatarAssignError} when the host rejects the upload.
		*/
		async function uploadAvatar(file) {
			const data = await new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => {
					resolve(String(reader.result).split(",")[1] ?? "");
				};
				reader.onerror = () => {
					reject(new AvatarAssignError("reading the file failed", "read-error"));
				};
				reader.readAsDataURL(file);
			});
			return serialize(async () => {
				const value = await call$2("upload", { request: {
					name: file.name,
					data
				} });
				await refresh();
				return value.asset;
			});
		}
		/**
		* Write one assignment (empty asset clears) and refresh the snapshot.
		* @param sessionId - member session id.
		* @param asset - asset file name, or '' to clear.
		* @throws {AvatarAssignError} when the host rejects the write.
		*/
		async function assignAvatar(sessionId, asset) {
			return serialize(async () => {
				const { assignments } = await call$2("assign", { request: {
					sessionId,
					asset
				} });
				publish$2({
					...snapshot$2,
					assignments,
					loaded: true
				});
			});
		}
		/** Delete one custom image and publish the confirmed library and assignment changes. */
		function deleteAvatar(asset) {
			return serialize(async () => {
				const { assignments } = await call$2("deleteAvatar", { request: { asset } });
				publish$2({
					...snapshot$2,
					assignments,
					assets: snapshot$2.assets.filter((name) => name !== asset),
					deletableAssets: snapshot$2.deletableAssets.filter((name) => name !== asset),
					loaded: true
				});
			});
		}
		// src/client/styles.ts
		/**
		* Team panel class map and stylesheet injection. Class names are prefixed
		* `tp-` and the style tag is inserted once at factory materialization — the
		* standalone equivalent of the in-repo CSS-modules build.
		*/
		const stylesheet = `.tp-root{position:relative}
.tp-trigger{display:inline-flex;align-items:center;gap:5px;min-height:28px;padding:3px 7px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary);font-size:12px;cursor:pointer}
.tp-trigger:focus-visible{color:var(--dsw-alias-label-primary)}
@media (hover:hover){.tp-trigger:hover{color:var(--dsw-alias-label-primary)}}
@container (max-width:480px){.tp-triggerLabel{display:none}}
.tp-count{color:var(--dsw-alias-label-caption);font-size:12px;font-weight:400;font-variant-numeric:tabular-nums;line-height:16px}
.tp-panel{--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);display:flex;flex-direction:column;position:fixed;z-index:100;box-sizing:border-box;width:min(500px,100vw - 32px);max-height:min(680px,calc(100vh - 32px),var(--dsh-anchored-max-height,100vh));padding:8px 2px 0;overflow:hidden;border:0;border-radius:12px;--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);box-shadow:var(--dsw-elevation-prominent);max-width:var(--dsh-anchored-max-width,none)}
.tp-panel::before{content:'';position:absolute;z-index:-1;inset:0;border-radius:12px;background:var(--dsw-specific-menu);backdrop-filter:var(--dsw-menu-backdrop-filter)}
.tp-panelCompact{width:min(320px,100vw - 32px)}
.tp-panelCompact .tp-roster{grid-template-columns:minmax(0,1fr)}
.tp-body{--dsh-scrollbar-track-margin:8px;flex:1 1 auto;min-height:0;padding:0 9px 16px 14px;overflow-y:auto;scrollbar-gutter:stable}
.tp-taskTitle{display:flex;align-items:center;gap:8px}
.tp-taskTitle strong{font-size:13px;font-weight:500}
.tp-panel h3{display:flex;align-items:center;gap:8px;margin:16px 0 8px 4px;color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500}
.tp-body section:first-of-type h3{margin-top:8px}
.tp-roster{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.tp-member{display:flex;align-items:flex-start;gap:8px;min-width:0;padding:10px 12px;border:0;--dsw-elevation-stroke-color:var(--dsw-alias-border-l2);box-shadow:var(--dsw-elevation-stroke);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:13px;text-align:left}
.tp-memberOpen{display:flex;flex:1 1 auto;min-width:0;padding:0;border:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.tp-memberOpen:disabled{cursor:default}
.tp-memberOpen:not(:disabled):focus-visible{outline:2px solid var(--dsw-alias-border-l3);outline-offset:2px;border-radius:6px}
.tp-memberCurrent{--dsw-elevation-stroke-color:color-mix(in srgb,var(--dsw-alias-state-business-primary) 40%,transparent);box-shadow:var(--dsw-elevation-stroke),inset 0 0 0 1px color-mix(in srgb,var(--dsw-alias-state-business-primary) 40%,transparent)}
.tp-member:focus-within{--dsw-elevation-stroke-color:var(--dsw-alias-border-l3);box-shadow:var(--dsw-elevation-panel)}
@media (hover:hover){.tp-member:hover{--dsw-elevation-stroke-color:var(--dsw-alias-border-l3);box-shadow:var(--dsw-elevation-panel)}}
.tp-memberDot{display:inline-flex;align-items:center;flex:none;position:relative}
.tp-runningDot{position:absolute;right:-2px;bottom:-1px;width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-state-success-primary);box-shadow:0 0 0 1.5px var(--dsw-alias-bg-layer-2);animation:tp-breathe 1.8s ease-in-out infinite}
@keyframes tp-breathe{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.78)}}
.tp-inactiveIcon{color:var(--dsw-alias-label-tertiary)}
.tp-memberText{display:flex;flex-direction:column;min-width:0}
.tp-memberName{display:inline-flex;align-items:center;gap:5px;min-width:0}
.tp-memberNameText,.tp-memberText small{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.tp-memberModel{display:inline}
.tp-currentTag{display:inline-block;flex:0 999 auto;min-width:0;padding:0 4px;overflow:hidden;font-size:10px;line-height:15px;text-overflow:ellipsis}
.tp-memberText small{color:var(--dsw-alias-label-tertiary);font-size:11px}
.tp-tasks{display:flex;flex-direction:column;gap:7px}
.tp-emptyNotice{margin:16px 0 0 4px;color:var(--dsw-alias-label-tertiary);font-size:12px}
.tp-task{padding:11px 13px;border:.5px solid var(--dsw-alias-border-l2);border-radius:9px;background:var(--dsw-alias-bg-layer-2)}
.tp-taskState{display:inline-flex;align-items:center;gap:6px;margin-left:auto;color:var(--dsw-alias-label-tertiary);font-size:11px}
.tp-task p{margin:5px 0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;white-space:pre-wrap}
.tp-clampedDescription{display:-webkit-box;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:2}
.tp-expandToggle{display:inline-flex;align-items:center;gap:2px;float:right;margin-left:10px;padding:0;border:0;background:transparent;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:20px;cursor:pointer}
.tp-expandToggle:focus-visible{color:var(--dsw-alias-label-primary)}
@media (hover:hover){.tp-expandToggle:hover{color:var(--dsw-alias-label-primary)}}
.tp-expandToggle svg{transition:transform 120ms ease}
.tp-expandToggleOpen{transform:rotate(180deg)}
.tp-meta{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:20px}
.tp-meta>span{margin-right:10px}
.tp-notice,.tp-error{display:flex;align-items:center;gap:6px;padding:9px;font-size:12px}
.tp-error{color:var(--dsw-alias-state-error-primary)}
.tp-avatarSeat{position:relative}
.tp-avatarButton{display:inline-flex;align-items:center;justify-content:center;padding:0;border:0;border-radius:6px;background:transparent;cursor:pointer}
.tp-avatarButton:focus-visible{outline:2px solid var(--dsw-alias-border-l3);outline-offset:1px}
.tp-avatarImage{display:block;width:32px;height:32px;border-radius:8px;object-fit:cover}
.tp-avatarMenu{--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);display:flex;flex-direction:column;position:fixed;z-index:110;box-sizing:border-box;min-width:200px;max-height:280px;padding:6px;overflow-y:auto;max-width:min(320px,calc(100vw - 24px));border-radius:10px;--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);box-shadow:var(--dsw-elevation-prominent);background:var(--dsw-specific-menu);backdrop-filter:var(--dsw-menu-backdrop-filter)}
.tp-avatarOptionRow{display:flex;align-items:center;min-width:0;gap:4px}
.tp-avatarOption{display:flex;align-items:center;gap:8px;flex:1 1 auto;min-width:0;padding:6px 8px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);font-size:12px;text-align:left;cursor:pointer}
.tp-avatarDelete{display:grid;place-items:center;flex:none;width:28px;height:28px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
.tp-avatarDelete:focus-visible,.tp-avatarDelete:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-state-error-primary)}
.tp-avatarDelete:disabled{opacity:.6;cursor:default}
.tp-avatarConfirm{display:flex;flex-direction:column;gap:8px;width:260px;max-width:100%;padding:8px;box-sizing:border-box;overflow-wrap:anywhere}
.tp-avatarOption:focus-visible{background:var(--dsw-alias-bg-layer-2)}
@media (hover:hover){.tp-avatarOption:hover{background:var(--dsw-alias-bg-layer-2)}}
.tp-avatarOptionActive{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 12%,transparent)}
.tp-avatarThumb{display:block;width:28px;height:28px;border-radius:6px;object-fit:cover;flex:none}
.tp-avatarName{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.tp-avatarClear{width:100%;padding:6px 8px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary);font-size:11px;text-align:left;cursor:pointer}
.tp-avatarClear:focus-visible,.tp-avatarClear:hover{color:var(--dsw-alias-label-primary)}
.tp-avatarUpload{display:flex;align-items:center;gap:6px;margin-top:4px;padding:6px 8px;border-top:1px solid var(--dsw-alias-border-l2);border-radius:0 0 6px 6px;color:var(--dsw-alias-label-secondary);font-size:11px;cursor:pointer}
.tp-avatarUpload:focus-within,.tp-avatarUpload:hover{color:var(--dsw-alias-label-primary)}
.tp-avatarUploadInput{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.tp-settingsTab{display:flex;flex-direction:column;gap:8px}
.tp-settingsHint{margin:0 0 4px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.tp-settingsRow{display:flex;align-items:center;gap:10px;min-width:0;padding:2px 0}
.tp-settingsLabel{flex:1 1 auto;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:var(--dsw-alias-label-primary);font-size:12px}
.tp-settingsSelect{flex:0 1 200px;min-width:0;max-width:200px}
.tp-settingsError{flex:none;color:var(--dsw-alias-state-error-primary);font-size:11px}
.tp-memberRemoveWrap{position:relative;display:flex;align-items:flex-start;gap:0;min-width:0}
.tp-memberRemoveWrap .tp-member{flex:1 1 auto;min-width:0}
.tp-memberRemove{display:none;flex:none;margin:4px 4px 0 0;padding:3px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer}
.tp-memberRemoveWrap:hover .tp-memberRemove,.tp-memberRemove:focus-visible{display:inline-flex}
.tp-memberRemove:hover:not(:disabled),.tp-memberRemove:focus-visible{color:var(--dsw-alias-state-error-primary)}
.tp-memberRemove:disabled{cursor:default}
.tp-confirmCard{display:flex;flex-direction:column;gap:8px;box-sizing:border-box;width:min(320px,100vw - 24px);padding:14px;border-radius:10px;--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);box-shadow:var(--dsw-elevation-prominent);background:var(--dsw-specific-menu);backdrop-filter:var(--dsw-menu-backdrop-filter);position:fixed;z-index:120}
.tp-confirmTitle{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500}
.tp-confirmDesc{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.tp-confirmError{color:var(--dsw-alias-state-error-primary);font-size:12px}
.tp-confirmActions{display:flex;justify-content:flex-end;gap:8px}
.tp-confirmCancel,.tp-confirmGo{padding:5px 12px;border:0;border-radius:6px;font-size:12px;cursor:pointer}
.tp-confirmCancel{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary)}
.tp-confirmGo{background:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-bg-inverted,#fff)}
.tp-confirmCancel:disabled,.tp-confirmGo:disabled{opacity:.6;cursor:default}
.tp-addSeat{margin-left:auto;display:inline-flex}
.tp-addTrigger{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer}
.tp-addTrigger:focus-visible{outline:2px solid var(--dsw-alias-border-l3);outline-offset:1px}
@media (hover:hover){.tp-addTrigger:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}}
.tp-addCard{display:flex;flex-direction:column;gap:10px;box-sizing:border-box;width:min(320px,100vw - 24px);padding:14px;border-radius:10px;--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);box-shadow:var(--dsw-elevation-prominent);background:var(--dsw-specific-menu);backdrop-filter:var(--dsw-menu-backdrop-filter);position:fixed;z-index:120}
.tp-addField{display:flex;flex-direction:column;gap:4px;margin:0;padding:0;border:0;color:var(--dsw-alias-label-secondary);font-size:12px}
.tp-addField legend{padding:0;color:var(--dsw-alias-label-secondary);font-size:12px}
.tp-addTextarea{box-sizing:border-box;width:100%;min-height:56px;resize:vertical;padding:6px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:12px;line-height:18px}
.tp-addInput{box-sizing:border-box;width:100%;padding:5px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:12px}
.tp-addTextarea:focus-visible,.tp-addInput:focus-visible{outline:2px solid var(--dsw-alias-border-l3)}
.tp-addDepthRow{display:flex;gap:12px}
.tp-addDepthOption{display:inline-flex;align-items:center;gap:4px;color:var(--dsw-alias-label-primary);font-size:12px;cursor:pointer}
.tp-addHint{color:var(--dsw-alias-label-tertiary);font-size:11px}
.tp-addSubmit{padding:5px 12px;border:0;border-radius:6px;background:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-bg-inverted,#fff);font-size:12px;cursor:pointer}
.tp-addSubmit:disabled{opacity:.6;cursor:default}
.tp-removedSection{margin-top:12px;padding-top:10px;border-top:1px solid var(--dsw-alias-border-l2)}
.tp-removedRow{display:flex;align-items:center;gap:8px;min-width:0;padding:2px 0}
.tp-removedLabel{flex:1 1 auto;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:var(--dsw-alias-label-secondary);font-size:12px}
.tp-restoreButton{flex:none;padding:3px 10px;border:0;border-radius:6px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:11px;cursor:pointer}
.tp-restoreButton:hover:not(:disabled),.tp-restoreButton:focus-visible{color:var(--dsw-alias-label-primary)}
.tp-restoreButton:disabled{opacity:.6;cursor:default}
`;
		const classNames = {
			root: "tp-root",
			trigger: "tp-trigger",
			triggerLabel: "tp-triggerLabel",
			count: "tp-count",
			panel: "tp-panel",
			panelCompact: "tp-panelCompact",
			body: "tp-body",
			roster: "tp-roster",
			member: "tp-member",
			memberOpen: "tp-memberOpen",
			memberCurrent: "tp-memberCurrent",
			memberDot: "tp-memberDot",
			runningDot: "tp-runningDot",
			inactiveIcon: "tp-inactiveIcon",
			memberText: "tp-memberText",
			memberName: "tp-memberName",
			memberNameText: "tp-memberNameText",
			memberModel: "tp-memberModel",
			memberStatusLine: "tp-memberText",
			currentTag: "tp-currentTag",
			tasks: "tp-tasks",
			emptyNotice: "tp-emptyNotice",
			task: "tp-task",
			taskTitle: "tp-taskTitle",
			taskState: "tp-taskState",
			clampedDescription: "tp-clampedDescription",
			expandToggle: "tp-expandToggle",
			expandToggleOpen: "tp-expandToggleOpen",
			meta: "tp-meta",
			notice: "tp-notice",
			error: "tp-error",
			avatarSeat: "tp-avatarSeat",
			avatarButton: "tp-avatarButton",
			avatarImage: "tp-avatarImage",
			avatarMenu: "tp-avatarMenu",
			avatarOptionRow: "tp-avatarOptionRow",
			avatarDelete: "tp-avatarDelete",
			avatarConfirm: "tp-avatarConfirm",
			avatarOption: "tp-avatarOption",
			avatarOptionActive: "tp-avatarOptionActive",
			avatarThumb: "tp-avatarThumb",
			avatarName: "tp-avatarName",
			avatarClear: "tp-avatarClear",
			avatarUpload: "tp-avatarUpload",
			avatarUploadInput: "tp-avatarUploadInput",
			settingsTab: "tp-settingsTab",
			settingsHint: "tp-settingsHint",
			settingsRow: "tp-settingsRow",
			settingsLabel: "tp-settingsLabel",
			settingsSelect: "tp-settingsSelect",
			settingsError: "tp-settingsError",
			memberRemoveWrap: "tp-memberRemoveWrap",
			memberRemove: "tp-memberRemove",
			confirmCard: "tp-confirmCard",
			confirmTitle: "tp-confirmTitle",
			confirmDesc: "tp-confirmDesc",
			confirmError: "tp-confirmError",
			confirmActions: "tp-confirmActions",
			confirmCancel: "tp-confirmCancel",
			confirmGo: "tp-confirmGo",
			addSeat: "tp-addSeat",
			addTrigger: "tp-addTrigger",
			addCard: "tp-addCard",
			addField: "tp-addField",
			addTextarea: "tp-addTextarea",
			addInput: "tp-addInput",
			addDepthRow: "tp-addDepthRow",
			addDepthOption: "tp-addDepthOption",
			addHint: "tp-addHint",
			addSubmit: "tp-addSubmit",
			removedSection: "tp-removedSection",
			removedRow: "tp-removedRow",
			removedLabel: "tp-removedLabel",
			restoreButton: "tp-restoreButton"
		};
		const TAG_ID = "dsh-team-panel/TeamAction.css";
		if (typeof document !== "undefined" && document.querySelector(`style[data-plugin-css=${JSON.stringify(TAG_ID)}`) === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-team-panel";
			tag.dataset.pluginCss = TAG_ID;
			tag.textContent = stylesheet;
			document.head.appendChild(tag);
		}
		// src/client/AvatarSeat.tsx
		/**
		* Render the member avatar and a picker for assigning or deleting library images.
		*/
		function AvatarSeat({ sessionId, t }) {
			const state = (0, react.useSyncExternalStore)(subscribe, getSnapshot, getSnapshot);
			const [open, setOpen] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const [uploading, setUploading] = (0, react.useState)(false);
			const [deleteTarget, setDeleteTarget] = (0, react.useState)(null);
			const [deleting, setDeleting] = (0, react.useState)(false);
			const deleteTrigger = (0, react.useRef)(null);
			const cancelDelete = (0, react.useRef)(null);
			const rootRef = (0, react.useRef)(null);
			const panelRef = (0, react.useRef)(null);
			const fileInputRef = (0, react.useRef)(null);
			const position = (0, _deepseek_ai_dsh_client_ui_primitives.useAnchoredPosition)({
				open,
				anchorRef: rootRef,
				panelRef,
				gap: 6,
				margin: 12,
				layoutKey: deleteTarget ?? void 0
			});
			(0, react.useEffect)(() => {
				loadAvatars();
			}, []);
			const changeOpen = (next) => {
				if (deleting) return;
				setOpen(next);
				setError(null);
				setDeleteTarget(null);
				deleteTrigger.current = null;
				if (next) loadAvatars();
			};
			(0, _deepseek_ai_dsh_client_ui_primitives.useDismissOnOutsidePointer)(rootRef, open, changeOpen, panelRef);
			(0, react.useEffect)(() => {
				if (deleteTarget !== null) cancelDelete.current?.focus();
				else if (open && deleteTrigger.current !== null) {
					([...panelRef.current?.querySelectorAll("[data-avatar-delete]") ?? []].find((candidate) => candidate.dataset.avatarDelete === deleteTrigger.current) ?? panelRef.current)?.focus();
					deleteTrigger.current = null;
				}
			}, [open, deleteTarget]);
			const dismissDelete = () => {
				if (deleting) return;
				setError(null);
				setDeleteTarget(null);
			};
			(0, react.useEffect)(() => {
				if (!open) return;
				const dismiss = (event) => {
					if (event.key !== "Escape") return;
					event.preventDefault();
					event.stopImmediatePropagation();
					if (deleting) return;
					if (deleteTarget !== null) {
						setError(null);
						setDeleteTarget(null);
					} else {
						changeOpen(false);
						rootRef.current?.querySelector("button")?.focus();
					}
				};
				document.addEventListener("keydown", dismiss, true);
				return () => {
					document.removeEventListener("keydown", dismiss, true);
				};
			}, [
				open,
				deleteTarget,
				deleting
			]);
			const file = state.assignments[sessionId];
			const busy = state.assets.length === 0 && !state.loaded;
			const deletable = new Set(state.deletableAssets);
			const confirmDelete = async () => {
				if (deleteTarget === null || deleting) return;
				setDeleting(true);
				setError(null);
				try {
					await deleteAvatar(deleteTarget);
					setDeleteTarget(null);
				} catch (reason) {
					if (reason instanceof AvatarAssignError && reason.detail === "teamPanel/unknown-asset") loadAvatars();
					setError(t("avatar.deleteFailed"));
				} finally {
					setDeleting(false);
				}
			};
			const choose = async (asset) => {
				try {
					await assignAvatar(sessionId, asset);
					setOpen(false);
				} catch (reason) {
					setError(reason instanceof AvatarAssignError ? reason.message : String(reason));
				}
			};
			const onPickFile = async (picked) => {
				if (picked === void 0) return;
				setUploading(true);
				setError(null);
				try {
					await assignAvatar(sessionId, await uploadAvatar(picked));
					setOpen(false);
				} catch (reason) {
					setError(reason instanceof AvatarAssignError ? reason.message : String(reason));
				} finally {
					setUploading(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				ref: rootRef,
				className: classNames.avatarSeat,
				"data-avatar-seat": true,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: classNames.avatarButton,
					"aria-label": t("avatar.pick"),
					"aria-haspopup": "menu",
					"aria-expanded": open,
					onClick: (event) => {
						event.stopPropagation();
						changeOpen(!open);
					},
					children: file === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconUserOutlineRegular, {
						size: 14,
						className: classNames.inactiveIcon
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
						className: classNames.avatarImage,
						src: `plugins/dsh-team-panel/assets/${encodeURIComponent(file)}`,
						alt: t("avatar.image"),
						draggable: false
					})
				}), open && (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					ref: panelRef,
					className: classNames.avatarMenu,
					style: position ?? {
						visibility: "hidden",
						left: 0,
						top: 0
					},
					role: deleteTarget === null ? "menu" : "dialog",
					"aria-label": t(deleteTarget === null ? "avatar.pick" : "avatar.deleteTitle"),
					tabIndex: -1,
					"data-avatar-menu": true,
					onPointerDown: (event) => {
						event.stopPropagation();
					},
					onClick: (event) => {
						event.stopPropagation();
					},
					children: [error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: classNames.error,
						role: "alert",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: "error" }), error]
					}), deleteTarget !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: classNames.avatarConfirm,
						"aria-busy": deleting,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: classNames.confirmTitle,
								children: t("avatar.deleteTitle")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: classNames.confirmDesc,
								children: t("avatar.deleteDesc", { asset: deleteTarget })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: classNames.confirmActions,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									ref: cancelDelete,
									type: "button",
									className: classNames.confirmCancel,
									disabled: deleting,
									onClick: dismissDelete,
									children: t("remove.cancel")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: classNames.confirmGo,
									disabled: deleting,
									onClick: () => {
										confirmDelete();
									},
									children: t(deleting ? "avatar.deleting" : "avatar.deleteTitle")
								})]
							})
						]
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						busy && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: classNames.notice,
							role: "status",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: "ongoing" }), t("avatar.loading")]
						}),
						!busy && state.assets.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: classNames.notice,
							role: "status",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: "warning" }), t("avatar.none")]
						}),
						state.assets.map((asset) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							role: "presentation",
							className: classNames.avatarOptionRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								role: "menuitemradio",
								"aria-checked": file === asset,
								className: file === asset ? `${classNames.avatarOption} ${classNames.avatarOptionActive}` : classNames.avatarOption,
								onClick: () => {
									choose(asset);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
									className: classNames.avatarThumb,
									src: `plugins/dsh-team-panel/assets/${encodeURIComponent(asset)}`,
									alt: "",
									draggable: false
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: classNames.avatarName,
									children: asset
								})]
							}), deletable.has(asset) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
								label: t("avatar.deleteTitle"),
								side: "left",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									role: "menuitem",
									className: classNames.avatarDelete,
									"aria-label": t("avatar.deleteLabel", { asset }),
									"aria-haspopup": "dialog",
									disabled: uploading,
									"data-avatar-delete": asset,
									onClick: () => {
										deleteTrigger.current = asset;
										setError(null);
										setDeleteTarget(asset);
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutlineRegular, { size: 14 })
								})
							})]
						}, asset)),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: classNames.avatarUpload,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutlineRegular, { size: 12 }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: uploading ? t("avatar.uploading") : t("avatar.upload") }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									ref: fileInputRef,
									type: "file",
									accept: "image/png,image/jpeg,image/gif,image/webp,image/svg+xml",
									className: classNames.avatarUploadInput,
									disabled: uploading,
									onChange: (event) => {
										onPickFile(event.target.files?.[0]);
										event.target.value = "";
									}
								})
							]
						}),
						file !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							role: "menuitem",
							className: classNames.avatarClear,
							onClick: () => {
								choose("");
							},
							children: t("avatar.clear")
						})
					] })]
				}), document.body)]
			});
		}
		// src/client/add-member.ts
		/**
		* Human-authorized member creation: the `teamPanel/addMember` RPC over the
		* browser `/api` Connection channel. The host maps the requested depth tier to
		* an Agent Preset, so this module sends only the tier number.
		*/
		/** Error carrying the host's failure code beside its message. */
		var AddMemberError = class extends Error {
			detail;
			constructor(message, detail) {
				super(message);
				this.name = "AddMemberError";
				this.detail = detail;
			}
		};
		/**
		* Create one roster member under the lead session.
		* @param request - member identity and task fields.
		* @returns the created member's session id.
		* @throws {AddMemberError} on transport failure or a failed RPC result.
		*/
		async function addMember(request) {
			const response = await fetch("api/teamPanel/addMember", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					type: "client-request",
					rpcId: `team-panel-add-${String(Date.now())}`,
					method: "teamPanel/addMember",
					payload: { args: { request } }
				})
			});
			if (!response.ok) throw new AddMemberError(`transport failure: HTTP ${String(response.status)}`, String(response.status));
			const result = (await response.json()).result;
			if (result === void 0 || !result.ok) {
				const code = result?.error?.code ?? "teamPanel/transport";
				throw new AddMemberError(result?.error?.message ?? code, code);
			}
			return result.value ?? { childId: "" };
		}
		// src/client/removed.ts
		const listeners$1 = /* @__PURE__ */ new Set();
		let rpcCounter$1 = 0;
		let snapshot$1 = {
			byLead: {},
			loaded: false
		};
		const inflight$1 = /* @__PURE__ */ new Map();
		function publish$1(next) {
			snapshot$1 = next;
			for (const listener of listeners$1) listener();
		}
		/** POST one Connection RPC envelope to the plugin's host namespace. */
		async function call$1(method, args) {
			rpcCounter$1 += 1;
			const response = await fetch(`api/teamPanel/${method}`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					type: "client-request",
					rpcId: `team-panel-removed-${rpcCounter$1}`,
					method: `teamPanel/${method}`,
					payload: { args }
				})
			});
			if (!response.ok) throw new Error(`transport failure: HTTP ${response.status}`);
			const result = (await response.json()).result;
			if (result === void 0 || !result.ok) throw new Error(result?.error?.message ?? result?.error?.code ?? "Request failed");
			return result.value;
		}
		/**
		* Load the archived-children set for one lead (deduplicated in flight).
		* @param leadId - lead session whose direct children are filtered.
		*/
		function loadRemoved(leadId) {
			if (inflight$1.has(leadId)) return;
			const operation = call$1("archivedChildren", { request: { sessionId: leadId } }).then((value) => {
				publish$1({
					byLead: {
						...snapshot$1.byLead,
						[leadId]: value.archived
					},
					loaded: true
				});
			}).catch(() => {
				publish$1({
					byLead: {
						...snapshot$1.byLead,
						[leadId]: []
					},
					loaded: true
				});
			}).finally(() => {
				inflight$1.delete(leadId);
			});
			inflight$1.set(leadId, operation);
		}
		/**
		* Record one member as removed after a successful archive.
		* @param leadId - lead session id.
		* @param childId - archived direct child.
		*/
		function markRemoved(leadId, childId) {
			const current = snapshot$1.byLead[leadId] ?? [];
			if (current.includes(childId)) return;
			publish$1({
				byLead: {
					...snapshot$1.byLead,
					[leadId]: [...current, childId]
				},
				loaded: true
			});
		}
		/**
		* Record one member as restored after a successful unarchive.
		* @param leadId - lead session id.
		* @param childId - unarchived direct child.
		*/
		function markRestored(leadId, childId) {
			const current = snapshot$1.byLead[leadId];
			if (current === void 0 || !current.includes(childId)) return;
			publish$1({
				byLead: {
					...snapshot$1.byLead,
					[leadId]: current.filter((id) => id !== childId)
				},
				loaded: true
			});
		}
		/** Subscribe hook backing React's `useSyncExternalStore`. */
		function subscribeRemoved(onStoreChange) {
			listeners$1.add(onStoreChange);
			return () => {
				listeners$1.delete(onStoreChange);
			};
		}
		/** Current snapshot getter for `useSyncExternalStore`. */
		function getRemovedSnapshot() {
			return snapshot$1;
		}
		/**
		* POST the stock workspace archive/unarchive RPC the sidebar uses
		* (`workspaceController`, wire namespace `workspace`).
		* @param method - `workspace/archiveSession` or `workspace/unarchiveSession`.
		* @param sessionId - target session id.
		*/
		async function workspaceCall(method, sessionId, stopActivity) {
			rpcCounter$1 += 1;
			const response = await fetch(`api/workspace/${method}`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					type: "client-request",
					rpcId: `team-panel-remove-${rpcCounter$1}`,
					method: `workspace/${method}`,
					payload: { args: { request: {
						sessionId,
						...stopActivity ? { stopActivity: true } : {}
					} } }
				})
			});
			if (!response.ok) throw new Error(`transport failure: HTTP ${response.status}`);
			const result = (await response.json()).result;
			if (result === void 0 || !result.ok) throw new Error(result?.error?.message ?? result?.error?.code ?? "Request failed");
		}
		/**
		* Remove one member: stop its work and archive its session through the
		* stock workspace registry, then mark it hidden.
		* @param leadId - lead session id for roster bookkeeping.
		* @param childId - member session to remove.
		* @throws when the archive RPC fails.
		*/
		async function removeMember(leadId, childId) {
			await workspaceCall("archiveSession", childId, true);
			markRemoved(leadId, childId);
		}
		/**
		* Restore one removed member by unarchiving its session.
		* @param leadId - lead session id for roster bookkeeping.
		* @param childId - member session to restore.
		* @throws when the unarchive RPC fails.
		*/
		async function restoreMember(leadId, childId) {
			await workspaceCall("unarchiveSession", childId, false);
			markRestored(leadId, childId);
		}
		// src/client/staged.ts
		const listeners = /* @__PURE__ */ new Set();
		let rpcCounter = 0;
		let snapshot = {
			byMember: {},
			loaded: false
		};
		let inflight;
		function publish(next) {
			snapshot = next;
			for (const listener of listeners) listener();
		}
		/** POST one Connection RPC envelope to the plugin's host namespace. */
		async function call(method, args) {
			rpcCounter += 1;
			const response = await fetch(`api/teamPanel/${method}`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					type: "client-request",
					rpcId: `team-panel-staged-${rpcCounter}`,
					method: `teamPanel/${method}`,
					payload: { args }
				})
			});
			if (!response.ok) throw new Error(`transport failure: HTTP ${response.status}`);
			const result = (await response.json()).result;
			if (result === void 0 || !result.ok) throw new Error(result?.error?.message ?? result?.error?.code ?? "Request failed");
			return result.value;
		}
		/** Load the staged-route map once per plugin lifetime (deduplicated in flight). */
		function loadStaged() {
			if (inflight !== void 0 || snapshot.loaded) return;
			inflight = call("stagedSelections", {}).then((value) => {
				publish({
					byMember: value.selections,
					loaded: true
				});
			}).catch(() => {
				publish({
					byMember: {},
					loaded: true
				});
			}).finally(() => {
				inflight = void 0;
			});
		}
		/**
		* Record one staged route after a successful cold-member switch.
		* @param member - member session id.
		* @param route - the route the member's next conversation uses.
		*/
		function markStaged(member, route) {
			publish({
				byMember: {
					...snapshot.byMember,
					[member]: route
				},
				loaded: true
			});
		}
		/**
		* Retire a member's staged route — the projection is now authoritative.
		* @param member - member session id whose staged route was applied.
		*/
		function markStagedApplied(member) {
			if (!(member in snapshot.byMember)) return;
			const { [member]: _drop, ...rest } = snapshot.byMember;
			publish({
				byMember: rest,
				loaded: snapshot.loaded
			});
		}
		/** Subscribe hook backing React's `useSyncExternalStore`. */
		function subscribeStaged(onStoreChange) {
			listeners.add(onStoreChange);
			return () => {
				listeners.delete(onStoreChange);
			};
		}
		/** Current snapshot getter for `useSyncExternalStore`. */
		function getStagedSnapshot() {
			return snapshot;
		}
		// src/client/TeamAction.tsx
		function statusKey(status) {
			switch (status) {
				case "pending": return "status.pending";
				case "in_progress": return "status.in_progress";
				case "completed": return "status.completed";
			}
		}
		function memberStatusKey(status) {
			switch (status) {
				case "running": return "memberStatus.running";
				case "inactive": return "memberStatus.inactive";
				case "provisioning": return "memberStatus.provisioning";
			}
		}
		function taskDotState(task) {
			switch (task.status) {
				case "pending": return "idle";
				case "in_progress": return "ongoing";
				case "completed": return "done";
			}
		}
		function TeamMemberRow({ member, memberCount, sessionId, useSessions, useSessionStatus, openTeammate, onError, t }) {
			const model = useSessions((state) => state.projectionsBySession[member.id]?.values.modelSelection?.next?.model);
			const shownModel = (0, react.useSyncExternalStore)(subscribeStaged, getStagedSnapshot).byMember[member.id]?.model ?? model;
			const running = useSessionStatus((state) => state.get(member.id)?.running);
			const summaryRunning = useSessions((state) => state.byId[member.id]?.running);
			const status = (running ?? summaryRunning ?? false) === true ? "running" : member.mode === "unknown" ? "provisioning" : "inactive";
			const isCurrent = member.id === sessionId;
			const highlightCurrent = isCurrent && memberCount > 1;
			const inert = isCurrent || member.mode !== "continuable";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
				label: t("open"),
				side: "bottom",
				gap: 4,
				disabled: inert,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: highlightCurrent ? `${classNames.member} ${classNames.memberCurrent}` : classNames.member,
					"data-member-card": true,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: classNames.memberDot,
						title: t(memberStatusKey(status)),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(AvatarSeat, {
							sessionId: member.id,
							t
						}), (status === "running" || status === "provisioning") && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: classNames.runningDot,
							"data-running-dot": true,
							"aria-hidden": "true"
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: classNames.memberOpen,
						disabled: inert,
						"aria-label": t("open"),
						onClick: () => {
							try {
								openTeammate(sessionId, member.id);
							} catch (reason) {
								onError(String(reason));
							}
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: classNames.memberText,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: classNames.memberName,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: classNames.memberNameText,
									children: member.label ?? member.id
								}), isCurrent && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
									tone: "info",
									className: classNames.currentTag,
									children: t("current")
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
								className: classNames.memberStatusLine,
								children: shownModel !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: classNames.memberModel,
									children: `${t("model")}: ${shownModel}`
								})
							})]
						})
					})]
				})
			});
		}
		/** Card plus its hover-gated remove control; the lead row has no remove. */
		function TeamChildRow(props) {
			const { member, t } = props;
			const [confirming, setConfirming] = (0, react.useState)(false);
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const anchorRef = (0, react.useRef)(null);
			const panelRef = (0, react.useRef)(null);
			const confirmPosition = (0, _deepseek_ai_dsh_client_ui_primitives.useAnchoredPosition)({
				open: confirming,
				anchorRef,
				panelRef,
				gap: 6,
				margin: 12
			});
			(0, react.useEffect)(() => {
				if (!confirming) return;
				const dismiss = (event) => {
					if (event.key !== "Escape") return;
					event.preventDefault();
					setConfirming(false);
				};
				document.addEventListener("keydown", dismiss);
				return () => {
					document.removeEventListener("keydown", dismiss);
				};
			}, [confirming]);
			(0, _deepseek_ai_dsh_client_ui_primitives.useDismissOnOutsidePointer)(anchorRef, confirming, setConfirming, panelRef);
			const confirmRemove = () => {
				if (busy) return;
				setBusy(true);
				setError(null);
				removeMember(props.sessionId, member.id).catch((reason) => {
					setError(reason instanceof Error ? reason.message : String(reason));
				}).finally(() => setBusy(false));
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: anchorRef,
				className: classNames.memberRemoveWrap,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TeamMemberRow, { ...props }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: classNames.memberRemove,
						"aria-label": t("remove.aria"),
						"aria-haspopup": "dialog",
						"aria-expanded": confirming,
						disabled: busy,
						onClick: (event) => {
							event.stopPropagation();
							setError(null);
							setConfirming((current) => !current);
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutlineRegular, { size: 11 })
					}),
					confirming && (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						ref: panelRef,
						className: classNames.confirmCard,
						style: confirmPosition ?? {
							visibility: "hidden",
							left: 0,
							top: 0
						},
						role: "dialog",
						"aria-label": t("remove.confirmTitle"),
						onPointerDown: (event) => {
							event.stopPropagation();
						},
						onClick: (event) => {
							event.stopPropagation();
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: classNames.confirmTitle,
								children: t("remove.confirmTitle")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: classNames.confirmDesc,
								children: t("remove.confirmDesc", { name: member.label ?? member.id })
							}),
							error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: classNames.confirmError,
								role: "alert",
								children: error
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: classNames.confirmActions,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: classNames.confirmCancel,
									disabled: busy,
									onClick: () => {
										setConfirming(false);
									},
									children: t("remove.cancel")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: classNames.confirmGo,
									disabled: busy,
									onClick: confirmRemove,
									children: busy ? t("remove.pending") : t("remove.confirm")
								})]
							})
						]
					}), document.body)
				]
			});
		}
		/** Roster-header control that creates a member under the lead with a chosen delegation depth. */
		function AddMemberSeat({ leadSessionId, t }) {
			const [open, setOpen] = (0, react.useState)(false);
			const [prompt, setPrompt] = (0, react.useState)("");
			const [label, setLabel] = (0, react.useState)("");
			const [depth, setDepth] = (0, react.useState)(1);
			const [pending, setPending] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const anchorRef = (0, react.useRef)(null);
			const panelRef = (0, react.useRef)(null);
			const promptRef = (0, react.useRef)(null);
			const position = (0, _deepseek_ai_dsh_client_ui_primitives.useAnchoredPosition)({
				open,
				anchorRef,
				panelRef,
				gap: 6,
				margin: 12
			});
			(0, _deepseek_ai_dsh_client_ui_primitives.useDismissOnOutsidePointer)(anchorRef, open, setOpen, panelRef);
			(0, react.useEffect)(() => {
				if (!open) return;
				promptRef.current?.focus();
				const dismiss = (event) => {
					if (event.key !== "Escape") return;
					event.preventDefault();
					setOpen(false);
				};
				document.addEventListener("keydown", dismiss);
				return () => {
					document.removeEventListener("keydown", dismiss);
				};
			}, [open]);
			const submit = () => {
				if (pending || prompt.trim() === "") return;
				setPending(true);
				setError(null);
				addMember({
					sessionId: leadSessionId,
					prompt: prompt.trim(),
					...label.trim() === "" ? {} : { label: label.trim() },
					depth
				}).then(() => {
					setPrompt("");
					setLabel("");
					setDepth(1);
					setOpen(false);
				}).catch((reason) => {
					setError(reason instanceof Error ? reason.message : String(reason));
				}).finally(() => {
					setPending(false);
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				ref: anchorRef,
				className: classNames.addSeat,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: classNames.addTrigger,
					"aria-label": t("add.aria"),
					"aria-haspopup": "dialog",
					"aria-expanded": open,
					onClick: () => {
						setError(null);
						setOpen((current) => !current);
					},
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutlineRegular, { size: 12 })
				}), open && (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					ref: panelRef,
					className: classNames.addCard,
					style: position ?? {
						visibility: "hidden",
						left: 0,
						top: 0
					},
					role: "dialog",
					"aria-label": t("add.title"),
					onPointerDown: (event) => {
						event.stopPropagation();
					},
					onClick: (event) => {
						event.stopPropagation();
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: classNames.confirmTitle,
							children: t("add.title")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: classNames.addField,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("add.prompt") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								ref: promptRef,
								className: classNames.addTextarea,
								value: prompt,
								placeholder: t("add.promptPlaceholder"),
								onChange: (event) => {
									setPrompt(event.target.value);
								}
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: classNames.addField,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("add.label") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "text",
								className: classNames.addInput,
								value: label,
								onChange: (event) => {
									setLabel(event.target.value);
								}
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
							className: classNames.addField,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("legend", { children: t("add.depth") }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: classNames.addDepthRow,
									children: [
										1,
										2,
										3
									].map((tier) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: classNames.addDepthOption,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "radio",
											name: "team-panel-add-depth",
											checked: depth === tier,
											onChange: () => {
												setDepth(tier);
											}
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: String(tier) })]
									}, tier))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
									className: classNames.addHint,
									children: t("add.depthHint")
								})
							]
						}),
						error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: classNames.confirmError,
							role: "alert",
							children: error
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: classNames.confirmActions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: classNames.confirmCancel,
								disabled: pending,
								onClick: () => {
									setOpen(false);
								},
								children: t("add.cancel")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: classNames.addSubmit,
								disabled: pending || prompt.trim() === "",
								onClick: submit,
								children: pending ? t("add.pending") : t("add.submit")
							})]
						})
					]
				}), document.body)]
			});
		}
		/** Task card with a two-line description clamp expanded from a toggle in the meta row. */
		function TaskCard({ task, t }) {
			const [expanded, setExpanded] = (0, react.useState)(false);
			const [clamped, setClamped] = (0, react.useState)(false);
			const textRef = (0, react.useRef)(null);
			(0, react.useLayoutEffect)(() => {
				if (expanded) return;
				const paragraph = textRef.current;
				/* v8 ignore next -- the paragraph mounts in the same commit as the effect. */
				if (paragraph === null) return;
				const measure = () => {
					setClamped(paragraph.scrollHeight > paragraph.clientHeight + 1);
				};
				measure();
				if (typeof ResizeObserver === "undefined") return;
				const observer = new ResizeObserver(measure);
				observer.observe(paragraph);
				return () => {
					observer.disconnect();
				};
			}, [task.content, expanded]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
				className: classNames.task,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: classNames.taskTitle,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: task.content }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: classNames.taskState,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: taskDotState(task) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t(statusKey(task.status)) })]
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: classNames.meta,
					children: (clamped || expanded) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: classNames.expandToggle,
						"aria-expanded": expanded,
						onClick: () => {
							setExpanded((current) => !current);
						},
						children: [t(expanded ? "task.collapse" : "task.expand"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {
							size: 12,
							className: expanded ? classNames.expandToggleOpen : void 0
						})]
					})
				})]
			});
		}
		/** Render the Team roster and read-only task board. */
		function TeamAction({ sessionId, useSession, useSessions, useSessionStatus, openTeammate, t }) {
			const [open, setOpen] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const rootRef = (0, react.useRef)(null);
			const triggerRef = (0, react.useRef)(null);
			const triggerLabelRef = (0, react.useRef)(null);
			const panelRef = (0, react.useRef)(null);
			const position = (0, _deepseek_ai_dsh_client_ui_primitives.useAnchoredPosition)({
				open,
				anchorRef: triggerRef,
				panelRef,
				gap: 5,
				margin: 16
			});
			const positioned = position !== null;
			const leadSessionId = useSession((snapshot) => snapshot.subagent?.address.parentSessionId) ?? sessionId;
			const catalog = useSessions((state) => state.projectionsBySession[leadSessionId]?.values.subagentCatalog);
			const tasks = useSessions((state) => state.projectionsBySession[leadSessionId]?.values.todos);
			useSessions((state) => state.projectionsBySession[leadSessionId]?.values.modelSelection?.next?.model);
			useSessionStatus((state) => state.get(leadSessionId)?.running);
			const opening = useSession((snapshot) => snapshot.openState === "loading");
			const listing = useSessions((state) => state.phase === "pending");
			const hoverTimer = (0, react.useRef)(void 0);
			const pinnedRef = (0, react.useRef)(false);
			const removed = (0, react.useSyncExternalStore)(subscribeRemoved, getRemovedSnapshot, getRemovedSnapshot);
			(0, react.useEffect)(() => {
				if (open) loadRemoved(leadSessionId);
			}, [open, leadSessionId]);
			(0, react.useEffect)(() => {
				if (open) loadStaged();
			}, [open]);
			const archivedChildren = new Set(removed.byLead[leadSessionId] ?? []);
			const members = [{
				id: leadSessionId,
				createdAt: 0,
				mode: "continuable",
				label: useSessions((state) => state.byId[leadSessionId]?.displayTitle) ?? leadSessionId
			}, ...(catalog ?? []).filter((entry) => entry.mode !== "external" && !archivedChildren.has(entry.id))];
			const cancelHoverChange = () => {
				clearTimeout(hoverTimer.current);
				hoverTimer.current = void 0;
			};
			(0, react.useEffect)(() => {
				cancelHoverChange();
				pinnedRef.current = false;
				setOpen(false);
				setError(null);
			}, [sessionId]);
			(0, react.useEffect)(() => cancelHoverChange, []);
			(0, react.useLayoutEffect)(() => {
				if (open && positioned && pinnedRef.current) panelRef.current?.focus();
			}, [open, positioned]);
			const changeOpen = (next) => {
				cancelHoverChange();
				if (!next) pinnedRef.current = false;
				setOpen(next);
			};
			const scheduleHoverOpen = () => {
				cancelHoverChange();
				if (open) return;
				const label = triggerLabelRef.current;
				/* v8 ignore next -- the label mounts with the trigger that received the hover. */
				if (label === null) return;
				if (getComputedStyle(label).display === "none") return;
				hoverTimer.current = setTimeout(() => {
					hoverTimer.current = void 0;
					changeOpen(true);
				}, 150);
			};
			const scheduleHoverClose = () => {
				cancelHoverChange();
				if (pinnedRef.current) return;
				hoverTimer.current = setTimeout(() => {
					hoverTimer.current = void 0;
					changeOpen(false);
				}, 120);
			};
			(0, _deepseek_ai_dsh_client_ui_primitives.useDismissOnOutsidePointer)(rootRef, open, changeOpen, panelRef);
			(0, react.useEffect)(() => {
				if (!open) return;
				const dismiss = (event) => {
					if (event.key !== "Escape") return;
					event.preventDefault();
					cancelHoverChange();
					pinnedRef.current = false;
					setOpen(false);
					if (panelRef.current?.contains(document.activeElement)) triggerRef.current?.focus();
				};
				document.addEventListener("keydown", dismiss);
				return () => {
					document.removeEventListener("keydown", dismiss);
				};
			}, [open]);
			const compact = members.length === 1 && (tasks?.length ?? 0) === 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: rootRef,
				className: classNames.root,
				"data-team-action": true,
				onMouseLeave: scheduleHoverClose,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					ref: triggerRef,
					onMouseEnter: scheduleHoverOpen,
					className: classNames.trigger,
					"aria-label": t("trigger"),
					"aria-haspopup": "dialog",
					"aria-expanded": open,
					onClick: () => {
						cancelHoverChange();
						pinnedRef.current = true;
						if (!open) changeOpen(true);
						else panelRef.current?.focus();
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconUsersOutlineRegular, { size: 14 }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						ref: triggerLabelRef,
						className: classNames.triggerLabel,
						children: t("trigger")
					})]
				}), open && (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					ref: panelRef,
					className: compact ? `${classNames.panel} ${classNames.panelCompact}` : classNames.panel,
					style: position ?? {
						visibility: "hidden",
						left: 0,
						top: 0
					},
					role: "dialog",
					tabIndex: -1,
					"aria-label": t("trigger"),
					"data-team-panel": true,
					onMouseEnter: cancelHoverChange,
					onMouseLeave: scheduleHoverClose,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: classNames.body,
						children: [
							error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: classNames.error,
								role: "alert",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: "error" }), error]
							}),
							catalog === void 0 && opening === void 0 && listing && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: classNames.notice,
								role: "status",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: "ongoing" }), t("loading")]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h3", { children: [
								t("roster"),
								members.length > 1 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: classNames.count,
									children: members.length
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(AddMemberSeat, {
									leadSessionId,
									t
								})
							] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: classNames.roster,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TeamMemberRow, {
									member: members[0],
									memberCount: members.length,
									sessionId,
									useSessions,
									useSessionStatus,
									openTeammate,
									onError: setError,
									t
								}, leadSessionId), members.slice(1).map((member) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TeamChildRow, {
									member,
									memberCount: members.length,
									sessionId,
									useSessions,
									useSessionStatus,
									openTeammate,
									onError: setError,
									onRemoved: setError,
									t
								}, member.id))]
							})] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", { children: (tasks?.length ?? 0) === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: classNames.emptyNotice,
								children: t("empty")
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h3", { children: [t("tasks"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: classNames.count,
								children: tasks?.length
							})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: classNames.tasks,
								children: tasks?.map((task) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TaskCard, {
									task,
									t
								}, task.content))
							})] }) })
						]
					})
				}), document.body)]
			});
		}
		// src/client/TeamPanelTab.tsx
		/** One member row: label, current avatar thumbnail, and the assignment select. */
		function MemberRow({ sessionId, label, assignedAsset, assets, onChoose, error }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: classNames.settingsRow,
				"data-settings-member": sessionId,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: classNames.settingsLabel,
						children: label
					}),
					assignedAsset !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
						className: classNames.avatarThumb,
						src: `plugins/dsh-team-panel/assets/${encodeURIComponent(assignedAsset)}`,
						alt: assignedAsset,
						draggable: false
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
						className: classNames.settingsSelect,
						value: assignedAsset ?? "",
						"aria-label": sessionId,
						onChange: (event) => {
							onChoose(sessionId, event.target.value);
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: "",
							children: "—"
						}), assets.map((asset) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: asset,
							children: asset
						}, asset))]
					}),
					error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: classNames.settingsError,
						role: "alert",
						children: error
					})
				]
			});
		}
		/**
		* The plugin's Plugins-settings tab: pre-configure avatar assignments for
		* roster members (every lead with a subagent catalog plus its children).
		* @param props Settings renderer props (locale + runtime).
		* @returns the settings tab page.
		*/
		function TeamPanelTab({ useSessions, t }) {
			const state = (0, react.useSyncExternalStore)(subscribe, getSnapshot, getSnapshot);
			const [errors, setErrors] = (0, react.useState)({});
			const [uploading, setUploading] = (0, react.useState)(false);
			const fileInputRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				loadAvatars();
			}, []);
			const removedState = (0, react.useSyncExternalStore)(subscribeRemoved, getRemovedSnapshot, getRemovedSnapshot);
			const [restoring, setRestoring] = (0, react.useState)(null);
			const [restoreError, setRestoreError] = (0, react.useState)(null);
			const catalogs = useSessions((store) => {
				const map = [];
				for (const [id, snapshot] of Object.entries(store.projectionsBySession)) {
					const catalog = snapshot.values.subagentCatalog;
					if (catalog !== void 0 && catalog.length > 0) map.push({
						leadId: id,
						entries: catalog
					});
				}
				return map;
			});
			const titles = useSessions((store) => store.byId);
			const labelOf = (leadId, childId) => {
				return (catalogs.find((group) => group.leadId === leadId)?.entries.find((row) => row.id === childId))?.label ?? titles[childId]?.displayTitle ?? childId;
			};
			const onRestore = (leadId, childId) => {
				if (restoring !== null) return;
				setRestoring(childId);
				setRestoreError(null);
				restoreMember(leadId, childId).catch((reason) => {
					setRestoreError(reason instanceof Error ? reason.message : String(reason));
				}).finally(() => {
					setRestoring(null);
				});
			};
			const removedRows = catalogs.flatMap(({ leadId, entries }) => (removedState.byLead[leadId] ?? []).filter((childId) => entries.some((entry) => entry.id === childId)).map((childId) => ({
				leadId,
				childId
			})));
			(0, react.useEffect)(() => {
				for (const { leadId } of catalogs) if (!(leadId in removedState.byLead) || !removedState.loaded) loadRemoved(leadId);
			});
			const onChoose = (sessionId, asset) => {
				assignAvatar(sessionId, asset).then(() => {
					setErrors((current) => ({
						...current,
						[sessionId]: ""
					}));
				}).catch((reason) => {
					setErrors((current) => ({
						...current,
						[sessionId]: reason instanceof AvatarAssignError ? reason.message : String(reason)
					}));
				});
			};
			const onUpload = (picked) => {
				if (picked === void 0) return;
				setUploading(true);
				uploadAvatar(picked).catch((reason) => {
					setErrors((current) => ({
						...current,
						__upload: reason instanceof AvatarAssignError ? reason.message : String(reason)
					}));
				}).finally(() => {
					setUploading(false);
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: classNames.settingsTab,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: classNames.settingsHint,
						children: t("settings.hint")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: classNames.avatarUpload,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutlineRegular, { size: 12 }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: uploading ? t("avatar.uploading") : t("avatar.upload") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								ref: fileInputRef,
								type: "file",
								accept: "image/png,image/jpeg,image/gif,image/webp,image/svg+xml",
								className: classNames.avatarUploadInput,
								disabled: uploading,
								onChange: (event) => {
									onUpload(event.target.files?.[0]);
									event.target.value = "";
								}
							})
						]
					}),
					errors.__upload !== void 0 && errors.__upload !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: classNames.settingsError,
						role: "alert",
						children: errors.__upload
					}),
					state.assets.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: classNames.notice,
						role: "status",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: state.loaded ? "warning" : "ongoing" }), t(state.loaded ? "settings.noAssets" : "avatar.loading")]
					}),
					catalogs.flatMap(({ leadId, entries }) => [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MemberRow, {
						sessionId: leadId,
						label: titles[leadId]?.displayTitle ?? leadId,
						assignedAsset: state.assignments[leadId],
						assets: state.assets,
						onChoose,
						error: errors[leadId] ?? null
					}, leadId), ...entries.filter((entry) => entry.mode !== "external").map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MemberRow, {
						sessionId: entry.id,
						label: entry.label ?? entry.id,
						assignedAsset: state.assignments[entry.id],
						assets: state.assets,
						onChoose,
						error: errors[entry.id] ?? null
					}, entry.id))]),
					catalogs.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: classNames.emptyNotice,
						children: t("settings.empty")
					}),
					removedRows.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: classNames.removedSection,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: classNames.settingsHint,
								children: t("settings.removed")
							}),
							restoreError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: classNames.settingsError,
								role: "alert",
								children: restoreError
							}),
							removedRows.map(({ leadId, childId }) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: classNames.removedRow,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: classNames.removedLabel,
									children: labelOf(leadId, childId)
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: classNames.restoreButton,
									disabled: restoring !== null,
									onClick: () => {
										onRestore(leadId, childId);
									},
									children: restoring === childId ? t("remove.pending") : t("settings.restore")
								})]
							}, childId))
						]
					}),
					catalogs.length > 0 && removedRows.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: classNames.emptyNotice,
						children: t("settings.removedEmpty")
					})
				]
			});
		}
		// src/client/TeamPanelPluginItem.tsx
		/** The Plugins-page card body for Team panel: avatar upload summary plus the removed-member restore list. */
		/**
		* Render the plugin's own page under Built-in plugin settings: a one-line
		* summary in `summary` view, the restore list in `page` view.
		* @param props - view discriminator + the standard session store seat + locale seat.
		* @returns summary text or the full page.
		*/
		function TeamPanelPluginItem({ view, useSessions, t }) {
			const removedState = (0, react.useSyncExternalStore)(subscribeRemoved, getRemovedSnapshot, getRemovedSnapshot);
			const catalogs = useSessions((store) => {
				const map = [];
				for (const [id, snapshot] of Object.entries(store.projectionsBySession)) {
					const catalog = snapshot.values.subagentCatalog;
					if (catalog !== void 0 && catalog.length > 0) map.push({
						leadId: id,
						entries: catalog
					});
				}
				return map;
			});
			const titles = useSessions((store) => store.byId);
			(0, react.useEffect)(() => {
				for (const { leadId } of catalogs) if (!(leadId in removedState.byLead)) loadRemoved(leadId);
			});
			if (view === "summary") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: t("settings.removed") });
			const rows = catalogs.flatMap(({ leadId, entries }) => (removedState.byLead[leadId] ?? []).filter((childId) => entries.some((entry) => entry.id === childId)).map((childId) => ({
				leadId,
				childId,
				label: entries.find((entry) => entry.id === childId)?.label ?? titles[childId]?.displayTitle ?? childId
			})));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: classNames.settingsTab,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: classNames.settingsHint,
						children: t("settings.removed")
					}),
					rows.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: classNames.removedRow,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: classNames.removedLabel,
							children: row.label
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: classNames.restoreButton,
							onClick: () => {
								restoreMember(row.leadId, row.childId).catch(() => void 0);
							},
							children: t("settings.restore")
						})]
					}, row.childId)),
					rows.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: classNames.emptyNotice,
						children: t("settings.removedEmpty")
					})
				]
			});
		}
		// src/client/composer-model.ts
		/** Call a catalog or live-agent endpoint without activating stored Session history. */
		async function modelRpc(method, args) {
			try {
				const response = await fetch(`api/${method}`, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						type: "client-request",
						rpcId: crypto.randomUUID(),
						method,
						payload: { args }
					})
				});
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				const envelope = await response.json();
				if (typeof envelope.result?.ok !== "boolean") throw new Error("Invalid model selection response");
				return envelope.result;
			} catch (error) {
				return {
					ok: false,
					error: {
						code: "gateway/internal",
						message: String(error),
						name: "RemoteError",
						details: {},
						isDSHRemoteError: true
					}
				};
			}
		}
		/** Register the native component with an addressed-session injection adapter. */
		function registerComposerModel(ctx) {
			ctx.inject(["modelDirectories"], (scope) => {
				scope.slots.inject("conversation.input.model.label", () => {
					const original = scope.slots.entries("conversation.input.model").find((entry) => entry.locale === "model");
					if (original?.inject === void 0 || typeof original.component !== "function") throw new Error("Team panel requires the installed native model selector");
					const nativeInject = original.inject;
					const NativeSelector = original.component;
					const faces = /* @__PURE__ */ new Map();
					const cleanups = /* @__PURE__ */ new Set();
					scope.effect(() => () => {
						for (const cleanup of cleanups) cleanup();
						cleanups.clear();
						faces.clear();
					}, "team-panel: model adapters");
					const presentation = {
						locked: false,
						renderSlot: ((_key, _owner, options) => options?.fallback ?? null)
					};
					return scope.slots.register({
						name: "conversation.input.right",
						id: "team-panel-child-model",
						order: 100,
						locale: "model",
						inject: (sessionId) => {
							const native = nativeInject(sessionId);
							const address = scope.sessions.subagentAddress(sessionId);
							if (address === void 0) return {
								...native,
								...presentation,
								available: false
							};
							const cached = faces.get(sessionId);
							if (cached !== void 0) return {
								...cached,
								...presentation
							};
							const sessionScope = scope.sessions.scope(sessionId);
							if (sessionScope === void 0) throw new Error("Missing child session scope");
							const directory = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(native.directory.getSnapshot());
							let pending = null;
							let selectionError = null;
							let disposed = false;
							let loading = false;
							let catalog = null;
							const stagedNow = () => getStagedSnapshot().byMember[sessionId];
							const sync = () => {
								if (disposed) return;
								const state = native.directory.getSnapshot();
								const staged = stagedNow();
								const current = (staged === void 0 ? null : {
									provider: staged.provider,
									model: staged.model,
									...staged.reasoningEffort === void 0 ? {} : { reasoningEffort: staged.reasoningEffort }
								}) ?? state.current ?? catalog?.default ?? null;
								const groups = catalog?.groups ?? state.groups;
								directory.set({
									...state,
									current,
									groups,
									failures: catalog?.failures ?? state.failures,
									routable: current === null ? null : groups.some((group) => group.id === current.provider && group.models.some((model) => model.id === current.model)),
									pending,
									error: selectionError ?? (catalog === null ? state.error : null),
									status: pending !== null ? "selecting" : selectionError !== null ? "error" : loading ? "loading" : catalog !== null ? "ready" : state.status
								});
							};
							const unsubscribe = native.directory.subscribe(() => {
								catalog = null;
								sync();
							});
							const unsubscribeStaged = subscribeStaged(sync);
							const cleanup = () => {
								if (disposed) return;
								disposed = true;
								unsubscribe();
								unsubscribeStaged();
								faces.delete(sessionId);
								cleanups.delete(cleanup);
							};
							cleanups.add(cleanup);
							sessionScope.effect(() => cleanup, "team-panel: child model directory");
							const face = {
								...native,
								available: address.mode === "continuable",
								directory,
								load: () => {
									if (loading || disposed) return;
									selectionError = null;
									loading = true;
									sync();
									modelRpc("session/modelCatalog", {}).then((result) => {
										if (disposed) return;
										if (result.ok) catalog = result.value;
										else selectionError = result.error.message;
									}).catch((error) => {
										if (!disposed) selectionError = String(error);
									}).finally(() => {
										loading = false;
										sync();
									});
								},
								select: async (selection) => {
									if (pending !== null || disposed) return void 0;
									pending = selection;
									selectionError = null;
									sync();
									const result = await modelRpc("teamPanel/switchModel", { request: {
										sessionId,
										...selection
									} });
									pending = null;
									if (result.ok) {
										if (result.value.staged) markStaged(sessionId, selection);
										else markStagedApplied(sessionId);
									} else selectionError = result.error.message;
									sync();
									return result.ok ? {
										ok: true,
										value: void 0
									} : result;
								}
							};
							faces.set(sessionId, face);
							return {
								...face,
								...presentation
							};
						}
					}, NativeSelector);
				});
			});
		}
		// src/client/locales.ts
		/** Team panel Web dictionaries. */
		/** Locale namespace owned by the Team panel Web UI. */
		const NS = "team-panel";
		/** Simplified Chinese dictionary and key source. */
		const zh = {
			trigger: "智能体团队",
			loading: "正在加载团队…",
			unavailable: "尚无成员",
			empty: "暂无任务，让主会话用 todo_write 维护计划即可显示",
			roster: "成员",
			tasks: "任务",
			model: "模型",
			open: "打开成员会话",
			current: "当前会话",
			"task.expand": "展开",
			"task.collapse": "收起",
			"memberStatus.running": "运行中",
			"memberStatus.inactive": "未运行",
			"memberStatus.provisioning": "准备中",
			"status.pending": "待处理",
			"status.in_progress": "进行中",
			"status.completed": "已完成",
			"avatar.pick": "选择头像",
			"avatar.image": "成员头像",
			"avatar.loading": "正在加载头像…",
			"avatar.none": "没有可选图片；点击下方“添加图片”上传",
			"avatar.upload": "添加图片",
			"avatar.uploading": "正在上传…",
			"avatar.clear": "恢复默认图标",
			"avatar.deleteTitle": "删除图片",
			"avatar.deleteLabel": "删除图片：{asset}",
			"avatar.deleteDesc": "从头像库删除「{asset}」？使用这张图的成员将恢复默认头像",
			"avatar.deleting": "正在删除…",
			"avatar.deleteFailed": "未能确认删除结果，请重新打开头像菜单查看",
			"settings.hint": "为团队成员预配头像：点击“添加图片”上传，然后给每个成员选择一张。",
			"settings.noAssets": "data/assets/ 目录还没有图片，放入后即在此可选。",
			"settings.empty": "暂无成员；打开带子代理的会话后在此配置。",
			"settings.removed": "已移除的成员（归档会话，可恢复）",
			"settings.removedEmpty": "没有已移除的成员。",
			"settings.restore": "恢复",
			"remove.aria": "从团队移除",
			"remove.confirmTitle": "移除成员",
			"remove.confirmDesc": "将停止“{name}”的运行并归档其会话；父会话不能再唤醒它，历史保留，可在插件设置中恢复。",
			"remove.confirm": "停止并移除",
			"remove.cancel": "取消",
			"remove.pending": "正在移除…",
			"add.aria": "添加成员",
			"add.title": "添加成员",
			"add.prompt": "任务内容",
			"add.promptPlaceholder": "新成员启动后执行的第一项任务",
			"add.label": "成员名称（可选）",
			"add.depth": "递归深度",
			"add.depthHint": "子树最深层级：1 = 不可再委派，2 = 可再委派一层，以此类推",
			"add.submit": "添加",
			"add.cancel": "取消",
			"add.pending": "正在创建…"
		};
		/** English dictionary checked against the Chinese key set. */
		const en = {
			trigger: "Agent team",
			loading: "Loading team…",
			unavailable: "No members yet",
			empty: "No tasks yet. Ask the lead session to keep a todo_write plan and they appear here.",
			roster: "Members",
			tasks: "Tasks",
			model: "Model",
			open: "Open member conversation",
			current: "Current chat",
			"task.expand": "Show more",
			"task.collapse": "Show less",
			"memberStatus.running": "Running",
			"memberStatus.inactive": "Inactive",
			"memberStatus.provisioning": "Provisioning",
			"status.pending": "Pending",
			"status.in_progress": "In progress",
			"status.completed": "Completed",
			"avatar.pick": "Choose avatar",
			"avatar.image": "Member avatar",
			"avatar.loading": "Loading avatars…",
			"avatar.none": "No images yet; use \"Add image\" below to upload one",
			"avatar.upload": "Add image",
			"avatar.uploading": "Uploading…",
			"avatar.clear": "Restore default icon",
			"avatar.deleteTitle": "Delete image",
			"avatar.deleteLabel": "Delete image: {asset}",
			"avatar.deleteDesc": "Delete “{asset}” from the avatar library? Members using it will return to their default avatars.",
			"avatar.deleting": "Deleting…",
			"avatar.deleteFailed": "Could not confirm deletion. Reopen the avatar picker to check.",
			"settings.hint": "Pre-configure team member avatars: upload images with \"Add image\", then pick one per member.",
			"settings.noAssets": "No images in data/assets/ yet; drop files there to pick them here.",
			"settings.empty": "No members yet; open a session with subagents to configure them here.",
			"settings.removed": "Removed members (archived sessions; restorable)",
			"settings.removedEmpty": "No removed members.",
			"settings.restore": "Restore",
			"remove.aria": "Remove from team",
			"remove.confirmTitle": "Remove member",
			"remove.confirmDesc": "Stops \"{name}\" and archives its session; the parent can no longer wake it. History is kept and you can restore it in plugin settings.",
			"remove.confirm": "Stop and remove",
			"remove.cancel": "Cancel",
			"remove.pending": "Removing…",
			"add.aria": "Add member",
			"add.title": "Add member",
			"add.prompt": "Initial task",
			"add.promptPlaceholder": "The first task the new member works on",
			"add.label": "Display name (optional)",
			"add.depth": "Delegation depth",
			"add.depthHint": "Deepest subtree level: 1 = no further delegation, 2 = one child level, and so on",
			"add.submit": "Add",
			"add.cancel": "Cancel",
			"add.pending": "Creating…"
		};
		// src/client/mount.ts
		/** Required browser services for navigation, slots, settings, and localized copy. */
		const inject = [
			"sessions",
			"uiWorkspace",
			"slots",
			"locale"
		];
		/**
		* Register the Team panel locale dictionaries and the conversation-header action.
		* The panel reads the lead Session's `subagentCatalog` and `todos` projections
		* from the shared Session store; this registration performs no RPC.
		* @param ctx - Client Context carrying the injected navigation, locale, slot, and Session services.
		*/
		function registerTeamPanelUi(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "team-panel: dictionaries");
			registerComposerModel(ctx);
			const sessions = ctx.sessions;
			const leadSessionId = (sessionId) => {
				return (sessions.binding(sessionId)?.session.getSnapshot().subagent?.address)?.parentSessionId ?? sessionId;
			};
			const actions = { openTeammate(sessionId, childSessionId) {
				const parentSessionId = leadSessionId(sessionId);
				if ((sessions.retainInfo(sessionId).getSnapshot().retainedBy.mainView ?? 0) === 0) return;
				if (childSessionId === parentSessionId) {
					ctx.uiWorkspace.openSession(parentSessionId);
					return;
				}
				ctx.uiWorkspace.openSession({
					parentSessionId,
					childSessionId,
					mode: "continuable"
				});
			} };
			ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
				name: "conversation.session.header.actions",
				id: "team-panel",
				order: -19,
				locale: NS,
				inject: () => actions
			}, TeamAction));
			ctx.slots.inject("settings.plugins.tab", () => ctx.slots.register({
				name: "settings.plugins.tab",
				id: "team-panel",
				order: 40,
				label: () => "Team panel",
				locale: NS
			}, TeamPanelTab));
			ctx.slots.inject("plugins.item", () => ctx.slots.register({
				name: "plugins.item",
				id: "team-panel",
				order: 60,
				label: () => "Team panel",
				locale: NS,
				inject: () => ({ view: "page" })
			}, TeamPanelPluginItem));
		}
		// src/client/index.ts
		/**
		* Register the Team panel locale dictionaries and header action on the Client Context.
		* @param ctx - Client Context with the declared `inject` services available.
		*/
		function apply(ctx) {
			registerTeamPanelUi(ctx);
		}
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map