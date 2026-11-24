/**
 * Host service: member avatar assignments for the Team panel.
 *
 * The panel renders a roster of the lead session and its subagent children;
 * each row can carry a user-chosen avatar image. Storage is two plain files
 * inside the plugin's data directory (default: the plugin package's own
 * `data/`):
 *
 * - `data/avatars.json` — `{ [sessionId]: "<file name>" }`, last write wins
 * - `data/assets/<file>` — the image files themselves, also served to the
 *   browser through the client-modules package-asset route
 *   (`/plugins/dsh-team-panel/assets/<file>`, requires the package
 *   `exports["./assets/*"]`), so the same file serves both the picker and
 *   the member card.
 *
 * Images can be uploaded or placed in the asset directory. Deleting an image
 * clears every assignment to it. Avatar operations serialize file changes and
 * publish the assignment map only after its atomic write.
 */
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
import { lstat, mkdir, readdir, readFile, realpath, rename, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join, resolve } from 'node:path';
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
const BUILTIN_ASSETS = new Set(['lead.png', 'member.png']);
/** Upload cap in decoded bytes. */
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
function nonEmpty(value) {
    return typeof value === 'string' && value.length > 0;
}
function isImageFile(name) {
    const dot = name.lastIndexOf('.');
    return dot > 0 && IMAGE_EXTENSIONS.has(name.slice(dot).toLowerCase());
}
function storageError(action, cause) {
    const message = `${action} failed: ${String(cause)}`;
    return new RemoteError('teamPanel/storage-error', message, { message }, { cause });
}
let TeamPanelAvatarService = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _list_decorators;
    let _assign_decorators;
    let _deleteAvatar_decorators;
    let _upload_decorators;
    let _modelCatalog_decorators;
    let _switchModel_decorators;
    let _addMember_decorators;
    let _archivedChildren_decorators;
    let _stagedSelections_decorators;
    return class TeamPanelAvatarService extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _list_decorators = [Remote('list')];
            _assign_decorators = [Remote('assign')];
            _deleteAvatar_decorators = [Remote('deleteAvatar')];
            _upload_decorators = [Remote('upload')];
            _modelCatalog_decorators = [Remote('modelCatalog')];
            _switchModel_decorators = [Remote('switchModel')];
            _addMember_decorators = [Remote('addMember')];
            _archivedChildren_decorators = [Remote('archivedChildren')];
            _stagedSelections_decorators = [Remote('stagedSelections')];
            __esDecorate(this, null, _list_decorators, { kind: "method", name: "list", static: false, private: false, access: { has: obj => "list" in obj, get: obj => obj.list }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _assign_decorators, { kind: "method", name: "assign", static: false, private: false, access: { has: obj => "assign" in obj, get: obj => obj.assign }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _deleteAvatar_decorators, { kind: "method", name: "deleteAvatar", static: false, private: false, access: { has: obj => "deleteAvatar" in obj, get: obj => obj.deleteAvatar }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _upload_decorators, { kind: "method", name: "upload", static: false, private: false, access: { has: obj => "upload" in obj, get: obj => obj.upload }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _modelCatalog_decorators, { kind: "method", name: "modelCatalog", static: false, private: false, access: { has: obj => "modelCatalog" in obj, get: obj => obj.modelCatalog }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _switchModel_decorators, { kind: "method", name: "switchModel", static: false, private: false, access: { has: obj => "switchModel" in obj, get: obj => obj.switchModel }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _addMember_decorators, { kind: "method", name: "addMember", static: false, private: false, access: { has: obj => "addMember" in obj, get: obj => obj.addMember }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _archivedChildren_decorators, { kind: "method", name: "archivedChildren", static: false, private: false, access: { has: obj => "archivedChildren" in obj, get: obj => obj.archivedChildren }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _stagedSelections_decorators, { kind: "method", name: "stagedSelections", static: false, private: false, access: { has: obj => "stagedSelections" in obj, get: obj => obj.stagedSelections }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        static inject = ['typertGateway', 'agents', 'llm', 'workspaceRegistry', 'subagents'];
        dataDir = __runInitializers(this, _instanceExtraInitializers);
        spawnProvider;
        depthPresets;
        cache;
        avatarOperations = Promise.resolve();
        /** In-memory mirror of `data/model-staged.json`: routes staged for cold members. */
        stagedSelectionCache;
        /** Standing agent/created listener applying staged selections; installed on first stage. */
        stagedSelectionListener;
        withAvatars(run) {
            const result = this.avatarOperations.then(run);
            this.avatarOperations = result.then(() => undefined, () => undefined);
            return result;
        }
        constructor(ctx, config = {}) {
            super(ctx, 'teamPanel', { namespace: 'teamPanel' });
            // Default data dir: the installed plugin package root's `data/`. This
            // module is the package's host entry at lib/host/index.js, so the
            // package.json sits two directories up.
            const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
            this.dataDir = nonEmpty(config?.dataDir) ? config.dataDir : join(pkgRoot, 'data');
            this.spawnProvider = nonEmpty(config?.spawnProvider) ? config.spawnProvider : 'spawn';
            this.depthPresets = Object.freeze({ ...(config?.depthPresets ?? {}) });
        }
        /**
         * Read the assignment map, serving subsequent reads from memory.
         * @returns the current session-id → asset-file map.
         */
        async readMap() {
            if (this.cache !== undefined)
                return this.cache;
            try {
                const raw = await readFile(join(this.dataDir, 'avatars.json'), 'utf8');
                const parsed = JSON.parse(raw);
                if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
                    throw new Error('expected an avatar assignment object');
                }
                const entries = [];
                for (const [id, asset] of Object.entries(parsed)) {
                    if (typeof asset !== 'string')
                        throw new Error('expected avatar file names as strings');
                    entries.push([id, asset]);
                }
                this.cache = Object.fromEntries(entries);
            }
            catch (error) {
                if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
                    this.cache = {};
                else
                    throw storageError('reading avatar assignments', error);
            }
            return this.cache;
        }
        /**
         * Persist the assignment map atomically and refresh the memory cache.
         * @param next - the complete replacement map.
         */
        async writeMap(next) {
            const file = join(this.dataDir, 'avatars.json');
            const tmp = `${file}.tmp`;
            await writeFile(tmp, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
            await rename(tmp, file);
            this.cache = next;
        }
        /**
         * List assignments and the available avatar image files.
         * @returns assignments plus asset file names.
         */
        async list() {
            return this.withAvatars(async () => {
                const assets = [];
                const assetsDir = join(this.dataDir, 'assets');
                if (existsSync(assetsDir)) {
                    for (const entry of await readdir(assetsDir, { withFileTypes: true })) {
                        if (entry.isFile() && isImageFile(entry.name))
                            assets.push(entry.name);
                    }
                }
                assets.sort();
                return { assignments: await this.readMap(), assets, deletableAssets: assets.filter(asset => !BUILTIN_ASSETS.has(asset)) };
            });
        }
        /**
         * Assign (or clear, with an empty asset) one member's avatar.
         * @param request - session id and the asset file name.
         * @returns the assignment map after the write.
         */
        async assign(request) {
            if (!nonEmpty(request?.sessionId)) {
                throw new RemoteError('teamPanel/invalid-request', 'assign requires sessionId as a non-empty string', {});
            }
            if (typeof request?.asset !== 'string') {
                throw new RemoteError('teamPanel/invalid-request', 'assign requires asset as a string (empty clears the assignment)', {});
            }
            return this.withAvatars(async () => {
                const current = { ...await this.readMap() };
                if (request.asset === '') {
                    delete current[request.sessionId];
                }
                else {
                    const file = join(this.dataDir, 'assets', basename(request.asset));
                    if (!existsSync(file) || !isImageFile(file)) {
                        throw new RemoteError('teamPanel/unknown-asset', `asset "${request.asset}" is not an image file under data/assets/`, { asset: request.asset });
                    }
                    Object.defineProperty(current, request.sessionId, { value: basename(request.asset), enumerable: true, configurable: true, writable: true });
                }
                try {
                    await this.writeMap(current);
                }
                catch (error) {
                    throw storageError('writing avatar assignments', error);
                }
                return { assignments: current };
            });
        }
        /**
         * Delete a user-added image and clear all member assignments to it.
         * @param request - exact file name from the avatar library.
         * @returns the committed assignment map after deletion.
         * @throws if the name is invalid, reserved, missing, or the change cannot be committed.
         */
        async deleteAvatar(request) {
            const asset = request?.asset;
            if (!nonEmpty(asset) || asset !== basename(asset) || /[\\\\/\u0000-\u001f]/u.test(asset)
                || !isImageFile(asset) || BUILTIN_ASSETS.has(asset)) {
                throw new RemoteError('teamPanel/invalid-request', 'expected a deletable avatar file name', {});
            }
            return this.withAvatars(async () => {
                const previous = await this.readMap();
                const current = Object.fromEntries(Object.entries(previous).filter(([, file]) => file !== asset));
                const assetsDir = resolve(this.dataDir, 'assets');
                const file = join(assetsDir, asset);
                const staged = resolve(this.dataDir, `.avatar-delete-${randomUUID()}`);
                try {
                    const root = await realpath(this.dataDir);
                    if (await realpath(assetsDir) !== join(root, 'assets') || !(await lstat(file)).isFile()) {
                        throw new RemoteError('teamPanel/unknown-asset', 'avatar is not a regular library file', { asset });
                    }
                    await rename(file, staged);
                }
                catch (error) {
                    if (error instanceof RemoteError)
                        throw error;
                    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
                        throw new RemoteError('teamPanel/unknown-asset', 'avatar is not in the library', { asset });
                    }
                    throw storageError('staging avatar deletion', error);
                }
                try {
                    if (Object.keys(current).length !== Object.keys(previous).length)
                        await this.writeMap(current);
                }
                catch (error) {
                    try {
                        await rename(staged, file);
                    }
                    catch (rollbackError) {
                        throw storageError('saving avatar deletion and restoring the image', new AggregateError([error, rollbackError]));
                    }
                    throw storageError('clearing avatar assignments', error);
                }
                try {
                    await unlink(staged);
                }
                catch (error) {
                    this.ctx.logger.warn('team-panel: avatar removed from the library but its staged file could not be cleaned up: %s', String(error));
                }
                return { assignments: current };
            });
        }
        /**
         * Store a browser upload under a unique asset URL, even after re-uploading a deleted name.
         * @param request - desired file name and base64 image bytes.
         * @returns the stored file name; existing files are never overwritten.
         */
        async upload(request) {
            if (!nonEmpty(request?.name) || typeof request?.data !== 'string' || request.data.length === 0) {
                throw new RemoteError('teamPanel/invalid-request', 'upload requires name and data (base64 image) as non-empty strings', {});
            }
            if (!isImageFile(request.name)) {
                throw new RemoteError('teamPanel/invalid-request', `upload name "${request.name}" must end with one of: ${[...IMAGE_EXTENSIONS].join(' ')}`, {});
            }
            let bytes;
            try {
                bytes = Buffer.from(request.data, 'base64');
            }
            catch {
                throw new RemoteError('teamPanel/invalid-request', 'upload data is not valid base64', {});
            }
            if (bytes.length === 0 || bytes.length > MAX_UPLOAD_BYTES) {
                throw new RemoteError('teamPanel/asset-too-large', `upload decoded to ${bytes.length} bytes; limit is ${MAX_UPLOAD_BYTES}`, { bytes: bytes.length, maxBytes: MAX_UPLOAD_BYTES });
            }
            const filename = basename(request.name).replace(/[^\w.-]+/g, '_');
            const dot = filename.lastIndexOf('.');
            const stored = `${filename.slice(0, dot).slice(0, 180)}-${randomUUID().slice(0, 12)}${filename.slice(dot).toLowerCase()}`;
            return this.withAvatars(async () => {
                const assetsDir = join(this.dataDir, 'assets');
                try {
                    await mkdir(assetsDir, { recursive: true });
                    await writeFile(join(assetsDir, stored), bytes, { flag: 'wx' });
                }
                catch (error) {
                    throw storageError('writing uploaded avatar', error);
                }
                return { asset: stored, overwritten: false };
            });
        }
        /**
         * Build the panel's model catalog: the same provider/model data the
         * composer's model menu shows (`llm.listProviders` → `listModels` →
         * `resolveModelInfo`), filtered to providers whose catalog loaded.
         * @returns provider-grouped routable models with display metadata.
         */
        async modelCatalog() {
            const providers = this.ctx.llm.listProviders();
            const groups = [];
            const failures = [];
            await Promise.all(providers.map(async (provider) => {
                try {
                    const models = await this.ctx.llm.listModels(provider.id);
                    const entries = await Promise.all(models.map(async (model) => {
                        const resolved = await this.ctx.llm.resolveModelInfo(provider.id, model.id);
                        const reasoningEfforts = resolved.reasoning?.efforts.map(effort => effort.id);
                        return {
                            id: model.id,
                            name: model.name ?? model.id,
                            ...(reasoningEfforts !== undefined && reasoningEfforts.length > 0 ? { reasoningEfforts } : {}),
                        };
                    }));
                    if (entries.length > 0)
                        groups.push({ id: provider.id, name: provider.name, models: entries });
                }
                catch (error) {
                    failures.push({ id: provider.id, message: String(error) });
                }
            }));
            return { groups, failures };
        }
        /**
         * Switch one member's model route by recording a `model/selection` event on
         * that member's Session — the same mechanism the subagent-model-switch
         * plugin exposes as `subagentRoute/switch`.
         *
         * A live/resident member (including the lead) is selected directly. A cold
         * member cannot be selected in place — no Agent holds its write path, and
         * materializing one just to record a route would run a turn — so its
         * selection is STAGED in plugin storage instead. A standing `agent/created`
         * listener applies staged selections while the member is still inside its
         * creation serial phase (before queued work is released), so the member's
         * next real conversation starts on the staged route. Switching itself adds
         * no message, notice, or turn, matching the native record-for-next-use
         * semantics of a model switch.
         * @param request - member session id and the target route.
         * @returns the applied or staged selection, and the member's previous route when one is recorded.
         */
        async switchModel(request) {
            if (!nonEmpty(request?.sessionId) || !nonEmpty(request?.provider) || !nonEmpty(request?.model)) {
                throw new RemoteError('teamPanel/invalid-request', 'switchModel requires sessionId, provider, and model as non-empty strings', {});
            }
            // Preflight the route exactly like session/selectModel does before recording.
            await this.ctx.llm.resolveCallConfig({
                provider: request.provider,
                model: request.model,
                ...request.reasoningEffort === undefined ? {} : { reasoningEffort: request.reasoningEffort },
            });
            const agent = this.ctx.agents.get(request.sessionId);
            if (agent !== undefined) {
                const header = agent.session.requestHeader()?.config;
                agent.model.select({
                    provider: request.provider,
                    model: request.model,
                    ...request.reasoningEffort === undefined ? {} : { reasoningEffort: request.reasoningEffort },
                });
                return {
                    applied: {
                        provider: request.provider,
                        model: request.model,
                        ...request.reasoningEffort === undefined ? {} : { reasoningEffort: request.reasoningEffort },
                    },
                    staged: false,
                    ...(header === undefined ? {} : { lastUsed: { provider: header.provider, model: header.model } }),
                };
            }
            await this.stageModelSelection({
                sessionId: request.sessionId,
                provider: request.provider,
                model: request.model,
                ...request.reasoningEffort === undefined ? {} : { reasoningEffort: request.reasoningEffort },
            });
            return {
                applied: {
                    provider: request.provider,
                    model: request.model,
                    ...request.reasoningEffort === undefined ? {} : { reasoningEffort: request.reasoningEffort },
                },
                staged: true,
            };
        }
        /**
         * Create a roster member under the lead session — the human-authorized
         * counterpart of the model's `subagent` tool. The selected depth tier maps
         * to an Agent Preset through the `depthPresets` config, so the member's own
         * delegation budget is the `maxDepth` that preset gives its `tool-subagent`
         * instance. The initial task runs like a normal delegation: its result is
         * delivered to the parent session, and the member stays live and continuable.
         * @param request - lead session id, initial task, optional label, and the
         *   depth tier (default 1).
         * @param signal - cancels creation before publication; absent, the member is
         *   created even if the caller goes away.
         * @returns the created member's session id.
         */
        async addMember(request, signal) {
            if (!nonEmpty(request?.sessionId) || !nonEmpty(request?.prompt)) {
                throw new RemoteError('teamPanel/invalid-request', 'addMember requires sessionId and prompt as non-empty strings', {});
            }
            const depth = request.depth ?? 1;
            if (!Number.isSafeInteger(depth) || depth < 1) {
                throw new RemoteError('teamPanel/invalid-request', 'addMember depth must be a positive safe integer', {});
            }
            const preset = this.depthPresets[String(depth)];
            if (preset === undefined && depth !== 1) {
                throw new RemoteError('teamPanel/depth-unconfigured', `depth ${String(depth)} has no preset configured in depthPresets`, { depth });
            }
            const parent = this.ctx.agents.get(request.sessionId);
            if (parent === undefined) {
                throw new RemoteError('teamPanel/not-live', `no live Agent for session "${request.sessionId}" to add the member under`, { sessionId: request.sessionId });
            }
            const label = nonEmpty(request.label)
                ? request.label
                : request.prompt.split('\n', 1)[0].slice(0, 60);
            const started = await this.ctx.subagents.startActivation({
                provider: this.spawnProvider,
                label,
                request: {
                    prompt: [{ type: 'text', text: request.prompt }],
                    parent,
                    ...preset === undefined ? {} : { agentPreset: preset },
                },
                signal: signal ?? new AbortController().signal,
                delivery: 'parent',
            });
            return { childId: started.childId };
        }
        /**
         * List the sessions removed from team rosters: the intersection of the
         * lead's durable subagent catalog with the Workspace registry's global
         * archive set. Removing a member archives its Session (with work stopped),
         * so this is exactly the hidden-from-roster set.
         * @param request - the lead session whose direct children are filtered.
         * @returns child session ids currently archived.
         */
        async archivedChildren(request) {
            if (!nonEmpty(request?.sessionId)) {
                throw new RemoteError('teamPanel/invalid-request', 'archivedChildren requires a non-empty sessionId', {});
            }
            const children = await this.ctx.subagents.listChildren(request.sessionId);
            const archived = new Set(this.ctx.workspaceRegistry.archivedSessionIds);
            return { archived: children.filter(child => archived.has(child.id)).map(child => child.id) };
        }
        /**
         * Read the staged model routes recorded for cold members, so the roster and
         * the composer selector can show the route that takes effect at each
         * member's next conversation instead of the stale durable one.
         * @returns session id → staged route.
         */
        async stagedSelections() {
            const selections = {};
            await this.withStagedSelections(() => { });
            for (const [id, route] of this.stagedSelectionCache ?? []) {
                selections[id] = {
                    provider: route.provider,
                    model: route.model,
                    ...route.reasoningEffort === undefined ? {} : { reasoningEffort: route.reasoningEffort },
                };
            }
            return { selections };
        }
        /**
         * Record one staged route for a cold member and install the standing
         * `agent/created` listener that applies staged selections. The listener runs
         * inside the Agent's serial creation phase — before queued work is released —
         * so the member's first real conversation after materialization starts on
         * the staged route; the selection event then persists like any native one.
         * Staged selections survive plugin reloads through a durable file beside the
         * avatar assignments.
         * @param request - the member id and the route to stage.
         * @returns once the staged selection is durably recorded.
         */
        async stageModelSelection(request) {
            const staged = {
                provider: request.provider,
                model: request.model,
                ...request.reasoningEffort === undefined ? {} : { reasoningEffort: request.reasoningEffort },
            };
            await this.withStagedSelections(store => { store.set(request.sessionId, staged); });
            this.installStagedSelectionListener();
        }
        /** Apply and retire staged selections when their member materializes. */
        installStagedSelectionListener() {
            if (this.stagedSelectionListener !== undefined)
                return;
            this.stagedSelectionListener = this.ctx.on('agent/created', ({ agent }) => {
                const selection = this.stagedSelectionCache?.get(agent.id);
                if (selection === undefined)
                    return undefined;
                agent.model.select(selection);
                void this.withStagedSelections(store => { store.delete(agent.id); });
                return undefined;
            }, { global: true });
            this.ctx.effect(() => () => {
                this.stagedSelectionListener?.();
                this.stagedSelectionListener = undefined;
            }, 'team-panel: staged selection listener');
        }
        /** Read, mutate, and atomically persist the staged-selection map. */
        async withStagedSelections(mutate) {
            const file = join(this.dataDir, 'model-staged.json');
            try {
                if (this.stagedSelectionCache === undefined) {
                    // A missing file is an empty map (first use), not an error.
                    const raw = await readFile(file, 'utf8').catch((error) => {
                        if (error.code === 'ENOENT')
                            return '{}';
                        throw error;
                    });
                    const parsed = JSON.parse(raw);
                    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
                        throw new Error('expected a staged-selection object');
                    }
                    const store = new Map();
                    for (const [id, value] of Object.entries(parsed)) {
                        if (typeof value !== 'object' || value === null)
                            throw new Error('expected staged-selection records');
                        const { provider, model, reasoningEffort } = value;
                        if (typeof provider !== 'string' || typeof model !== 'string'
                            || (reasoningEffort !== undefined && typeof reasoningEffort !== 'string')) {
                            throw new Error('expected staged-selection route fields');
                        }
                        store.set(id, {
                            provider,
                            model,
                            ...reasoningEffort === undefined ? {} : { reasoningEffort: reasoningEffort },
                        });
                    }
                    this.stagedSelectionCache = store;
                }
                mutate(this.stagedSelectionCache);
                await mkdir(this.dataDir, { recursive: true });
                await writeFile(file, `${JSON.stringify(Object.fromEntries(this.stagedSelectionCache), null, 2)}\n`);
            }
            catch (error) {
                this.stagedSelectionCache = undefined;
                throw storageError('recording the staged model selection', error);
            }
        }
    };
})();
export { TeamPanelAvatarService };
/** Re-render one filtered `list_agents` result the way the stock tool renders it. */
function renderAgentRows(rows) {
    return rows.map(row => row);
}
/**
 * Filter archived (team-removed) subagents out of the model-facing
 * `list_agents` result so agents the human removed stay invisible to the
 * model too. Runs as a `tools/post-execute` listener: only successful
 * `list_agents` calls are rewritten; every other result passes through.
 */
function filterListAgents(ctx) {
    const listener = ctx.on('tools/post-execute', async (exec, result, next) => {
        const rows = exec.name === 'list_agents' && !result.isError
            && Array.isArray(result.value)
            ? result.value : undefined;
        const archived = rows !== undefined && rows.length > 0
            ? new Set(ctx.workspaceRegistry.archivedSessionIds) : new Set();
        const kept = rows?.filter(row => !archived.has(row.id));
        const rewrite = kept !== undefined && kept.length !== rows?.length;
        const decision = await next();
        if (!rewrite || decision.kind !== 'accept' || kept === undefined)
            return decision;
        // Value replacement alone re-renders through the stock tool's own output.render.
        return { kind: 'accept', value: renderAgentRows(kept) };
    });
    return listener;
}
/**
 * Refuse `send_message` and `interrupt_agent` calls whose target the human
 * already removed from the team, with a reason naming the removal. Without
 * this the call reaches the delivery layer and fails with an opaque
 * authorization error instead of the actionable one.
 */
function refuseRemovedTargets(ctx) {
    const listener = ctx.on('tools/pre-execute', async (exec, next) => {
        if (exec.name === 'send_message' || exec.name === 'interrupt_agent') {
            const target = exec.arguments?.agent_id;
            if (typeof target === 'string' && ctx.workspaceRegistry.archivedSessionIds.includes(target)) {
                return {
                    kind: 'deny',
                    reason: `agent ${target} was removed from the team; restore it in the Team panel settings to message it again`,
                };
            }
        }
        return next();
    });
    return listener;
}
export const name = 'dsh-team-panel';
export const inject = TeamPanelAvatarService.inject;
export function apply(ctx, config = {}) {
    ctx.plugin(TeamPanelAvatarService, config);
    ctx.effect(() => filterListAgents(ctx), 'team-panel: list_agents archive filter');
    ctx.effect(() => refuseRemovedTargets(ctx), 'team-panel: removed-target refusal');
}
