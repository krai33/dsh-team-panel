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
import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
declare module '@deepseek-ai/dsh-typert-protocol' {
    interface RemoteErrorDetailsMap {
        /** Request validation refused the call; fields are missing or empty. */
        'teamPanel/invalid-request': {};
        /** The named asset file does not exist in the plugin data directory. */
        'teamPanel/unknown-asset': {
            readonly asset: string;
        };
        /** Reading or writing the mapping file failed. */
        'teamPanel/storage-error': {
            readonly message: string;
        };
        /** Uploaded image content exceeds the size limit. */
        'teamPanel/asset-too-large': {
            readonly bytes: number;
            readonly maxBytes: number;
        };
        /** No live Agent holds the named subagent session. */
        'teamPanel/not-live': {
            readonly sessionId: string;
        };
        /** The requested provider/model route is not resolvable. */
        'teamPanel/route-unavailable': {
            readonly provider: string;
            readonly model: string;
        };
        /** The selected depth has no preset configured in `depthPresets`. */
        'teamPanel/depth-unconfigured': {
            readonly depth: number;
        };
    }
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        agents: import('@deepseek-ai/dsh-agent').AgentRegistry;
        llm: import('@deepseek-ai/dsh-llm').LlmRuntime;
        workspaceRegistry: import('@deepseek-ai/dsh-workspace').WorkspaceRegistry;
        subagents: import('@deepseek-ai/dsh-subagent').SubagentRuntime;
    }
}
/** One row of the avatar assignment map (session id → asset file name). */
export type AvatarMap = Readonly<Record<string, string>>;
/** Response of `list`: assignments plus the available image files. */
export interface AvatarListValue {
    /** Current session-id → file-name assignments. */
    assignments: AvatarMap;
    /** File names available in the plugin's `data/assets/` directory. */
    assets: string[];
    /** User-added images that may be deleted from the library. */
    deletableAssets: string[];
}
/** Request body of `assign`. */
export interface AvatarAssignRequest {
    /** Session whose member card carries the avatar. */
    sessionId: string;
    /** File name below `data/assets/`; empty clears the assignment. */
    asset: string;
}
/** Request body of `upload`: one browser-picked image file. */
export interface AvatarUploadRequest {
    /** Desired file name below `data/assets/`; sanitized server-side. */
    name: string;
    /** Image bytes, base64-encoded. */
    data: string;
}
/** Response of `upload`. */
export interface AvatarUploadValue {
    /** The stored file name (sanitized; may differ from the request). */
    asset: string;
    /** Whether an existing file with that name was overwritten. */
    overwritten: boolean;
}
export declare class TeamPanelAvatarService extends TypertRemoteService {
    static inject: string[];
    private readonly dataDir;
    private readonly spawnProvider;
    private readonly depthPresets;
    private cache;
    private avatarOperations;
    /** In-memory mirror of `data/model-staged.json`: routes staged for cold members. */
    private stagedSelectionCache;
    /** Standing agent/created listener applying staged selections; installed on first stage. */
    private stagedSelectionListener;
    private withAvatars;
    constructor(ctx: Context, config?: {
        dataDir?: string;
        /** Subagent provider that materializes members; default `spawn`. */
        spawnProvider?: string;
        /**
         * Delegation-depth tiers for `addMember`, keyed by the depth the dialog
         * offers: each value is the Agent Preset the member is created under.
         * Depth `1` with no entry creates the member under the parent's current
         * preset (today's no-delegation default); any other unmapped depth is
         * refused with `teamPanel/depth-unconfigured`.
         */
        depthPresets?: Record<string, string>;
    });
    /**
     * Read the assignment map, serving subsequent reads from memory.
     * @returns the current session-id → asset-file map.
     */
    private readMap;
    /**
     * Persist the assignment map atomically and refresh the memory cache.
     * @param next - the complete replacement map.
     */
    private writeMap;
    /**
     * List assignments and the available avatar image files.
     * @returns assignments plus asset file names.
     */
    list(): Promise<AvatarListValue>;
    /**
     * Assign (or clear, with an empty asset) one member's avatar.
     * @param request - session id and the asset file name.
     * @returns the assignment map after the write.
     */
    assign(request: AvatarAssignRequest): Promise<{
        assignments: AvatarMap;
    }>;
    /**
     * Delete a user-added image and clear all member assignments to it.
     * @param request - exact file name from the avatar library.
     * @returns the committed assignment map after deletion.
     * @throws if the name is invalid, reserved, missing, or the change cannot be committed.
     */
    deleteAvatar(request: {
        asset: string;
    }): Promise<{
        assignments: AvatarMap;
    }>;
    /**
     * Store a browser upload under a unique asset URL, even after re-uploading a deleted name.
     * @param request - desired file name and base64 image bytes.
     * @returns the stored file name; existing files are never overwritten.
     */
    upload(request: AvatarUploadRequest): Promise<AvatarUploadValue>;
    /**
     * Build the panel's model catalog: the same provider/model data the
     * composer's model menu shows (`llm.listProviders` → `listModels` →
     * `resolveModelInfo`), filtered to providers whose catalog loaded.
     * @returns provider-grouped routable models with display metadata.
     */
    modelCatalog(): Promise<{
        groups: Array<{
            id: string;
            name: string;
            models: Array<{
                id: string;
                name: string;
                reasoningEfforts?: string[];
            }>;
        }>;
        failures: Array<{
            id: string;
            message: string;
        }>;
    }>;
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
    switchModel(request: {
        sessionId: string;
        provider: string;
        model: string;
        reasoningEffort?: string;
    }): Promise<{
        applied: {
            provider: string;
            model: string;
            reasoningEffort?: string;
        };
        staged: boolean;
        lastUsed?: {
            provider: string;
            model: string;
        };
    }>;
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
    addMember(request: {
        sessionId: string;
        prompt: string;
        label?: string;
        depth?: number;
    }, signal?: AbortSignal): Promise<{
        childId: string;
    }>;
    /**
     * List the sessions removed from team rosters: the intersection of the
     * lead's durable subagent catalog with the Workspace registry's global
     * archive set. Removing a member archives its Session (with work stopped),
     * so this is exactly the hidden-from-roster set.
     * @param request - the lead session whose direct children are filtered.
     * @returns child session ids currently archived.
     */
    archivedChildren(request: {
        sessionId: string;
    }): Promise<{
        archived: string[];
    }>;
    /**
     * Read the staged model routes recorded for cold members, so the roster and
     * the composer selector can show the route that takes effect at each
     * member's next conversation instead of the stale durable one.
     * @returns session id → staged route.
     */
    stagedSelections(): Promise<{
        selections: Record<string, {
            provider: string;
            model: string;
            reasoningEffort?: string;
        }>;
    }>;
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
    private stageModelSelection;
    /** Apply and retire staged selections when their member materializes. */
    private installStagedSelectionListener;
    /** Read, mutate, and atomically persist the staged-selection map. */
    private withStagedSelections;
}
export declare const name = "dsh-team-panel";
export declare const inject: string[];
export declare function apply(ctx: Context, config?: {
    dataDir?: string;
}): void;
