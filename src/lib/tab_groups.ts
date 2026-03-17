import {
    activeTabId,
    activeWindowId,
    browserBg,
    removeActiveWindowValue,
} from "./webext"

/**
 * Check if native Firefox tab groups API is available
 */
export function hasNativeTabGroups(): boolean {
    return (
        browserBg.tabs?.group !== undefined && browserBg.tabGroups !== undefined
    )
}

/**
 * Get or create a native tab group ID from a group name
 */
async function getOrCreateGroupId(
    name: string,
    windowId?: number,
): Promise<number> {
    if (!hasNativeTabGroups()) {
        // Fall back to legacy implementation
        return Promise.resolve(-1)
    }

    if (windowId === undefined) {
        windowId = await activeWindowId()
    }

    // Query existing groups
    const groups = await browserBg.tabGroups.query({ windowId })
    const existingGroup = groups.find(g => g.title === name)

    if (existingGroup) {
        return existingGroup.id
    }

    // Create a new group by grouping a tab
    const tab = await browserBg.tabs.create({
        windowId,
        active: false,
    })
    const groupId = await browserBg.tabs.group({
        tabIds: [tab.id],
        createProperties: { windowId },
    })

    // Set the group title (color will default to something reasonable)
    await browserBg.tabGroups.update(groupId, { title: name })

    // Close the temporary tab
    await browserBg.tabs.remove(tab.id)

    return groupId
}

/**
 * Get group ID from name without creating if it doesn't exist
 */
async function getGroupIdFromName(
    name: string,
    windowId?: number,
): Promise<number | undefined> {
    if (!hasNativeTabGroups()) {
        return undefined
    }

    if (windowId === undefined) {
        windowId = await activeWindowId()
    }

    const groups = await browserBg.tabGroups.query({ windowId })
    const group = groups.find(g => g.title === name)
    return group?.id
}

/**
 * Return a set of the current window's tab groups (empty if there are none).
 *
 * For native tab groups, returns the titles of all groups.
 *
 */
export async function tgroups() {
    if (hasNativeTabGroups()) {
        const windowId = await activeWindowId()
        const groups = await browserBg.tabGroups.query({ windowId })
        return new Set<string>(groups.map(g => g.title).filter(t => t))
    }

    // Fall back to legacy implementation
    const groups = await browserBg.sessions.getWindowValue(
        await activeWindowId(),
        "tridactyl-tgroups",
    )
    return new Set<string>(groups as string[])
}

/**
 * Set the current window's tab groups.
 *
 * Note: For native tab groups, this is no-op since groups are managed by Firefox.
 * The function exists for API compatibility.
 *
 */
export async function setTgroups(groups: Set<string>) {
    if (hasNativeTabGroups()) {
        // Native groups are managed by Firefox
        return
    }

    return browserBg.sessions.setWindowValue(
        await activeWindowId(),
        "tridactyl-tgroups",
        [...groups],
    )
}

/**
 * Clear the current window's tab groups.
 *
 */
export function clearTgroups() {
    return removeActiveWindowValue("tridactyl-tgroups")
}

/**
 * Return the active tab group for the window or undefined.
 *
 * For native tab groups, returns the title of the group containing the active tab.
 *
 */
export async function windowTgroup(id?: number) {
    if (hasNativeTabGroups()) {
        const windowId = id ?? (await activeWindowId())
        const activeTab = await browserBg.tabs.query({
            windowId,
            active: true,
        })
        if (!activeTab.length) return undefined

        const tab = activeTab[0]
        if (tab.groupId === -1) return undefined

        const groups = await browserBg.tabGroups.query({
            windowId,
        })
        const group = groups.find(g => g.id === tab.groupId)
        return group?.title
    }

    if (id === undefined) {
        id = await activeWindowId()
    }
    return browserBg.sessions.getWindowValue(
        id,
        "tridactyl-active-tgroup",
    ) as unknown as string
}

/**
 * Set the active tab group for a window.
 *
 * For native tab groups, this switches to the first tab in the specified group.
 *
 */
export async function setWindowTgroup(name: string, id?: number) {
    if (hasNativeTabGroups()) {
        const windowId = id ?? (await activeWindowId())
        const groupId = await getGroupIdFromName(name, windowId)
        if (groupId !== undefined) {
            // Activate the first tab in the group
            const tabs = await browserBg.tabs.query({
                windowId,
                groupId,
            })
            if (tabs.length > 0) {
                await browserBg.tabs.update(tabs[0].id, { active: true })
            }
        }
        return
    }

    if (id === undefined) {
        id = await activeWindowId()
    }
    return browserBg.sessions.setWindowValue(
        id,
        "tridactyl-active-tgroup",
        name,
    )
}

/*
 * Return the last active tab group for a window or undefined.
 *
 */
export async function windowLastTgroup(id?: number) {
    if (hasNativeTabGroups()) {
        // For native groups, use lastAccessed to determine last active
        const windowId = id ?? (await activeWindowId())
        const currentGroup = await windowTgroup(windowId)
        const groups = await browserBg.tabGroups.query({ windowId })
        const otherGroups = groups.filter(g => g.title !== currentGroup)

        if (otherGroups.length === 0) return undefined

        // Get the most recently accessed tab in each group
        let lastGroup: string | undefined
        let maxLastAccessed = 0

        for (const group of otherGroups) {
            const tabs = await browserBg.tabs.query({
                windowId,
                groupId: group.id,
            })
            const groupLastAccessed = Math.max(
                ...tabs.map(t => t.lastAccessed || 0),
            )
            if (groupLastAccessed > maxLastAccessed) {
                maxLastAccessed = groupLastAccessed
                lastGroup = group.title
            }
        }

        return lastGroup
    }

    const otherGroupsTabs = await tgroupTabs(await windowTgroup(id), true)
    if (otherGroupsTabs.length === 0) {
        return undefined
    }
    otherGroupsTabs.sort((a, b) => b.lastAccessed - a.lastAccessed)
    const lastTabId = otherGroupsTabs[0].id
    return tabTgroup(lastTabId)
}

/**
 * Clear the active tab group for the current window.
 *
 */
export function clearWindowTgroup() {
    return removeActiveWindowValue("tridactyl-active-tgroup")
}

/**
 * Return a tab's tab group.
 *
 * For native tab groups, returns the title of the group the tab belongs to.
 *
 */
export async function tabTgroup(id?: number) {
    if (hasNativeTabGroups()) {
        const tabId = id ?? (await activeTabId())
        const tab = await browserBg.tabs.get(tabId)
        if (tab.groupId === -1) return undefined

        const groups = await browserBg.tabGroups.query({
            windowId: tab.windowId,
        })
        const group = groups.find(g => g.id === tab.groupId)
        return group?.title
    }

    if (id === undefined) {
        id = await activeTabId()
    }
    return browserBg.sessions.getTabValue(
        id,
        "tridactyl-tgroup",
    ) as unknown as string
}

/**
 * Return a list of tab ids.
 *
 */
async function tabIdsOrCurrent(ids?: number | number[]): Promise<number[]> {
    if (!ids) {
        ids = [await activeTabId()]
    } else if (!Array.isArray(ids)) {
        ids = [ids]
    }
    return ids
}

/**
 * Set the a tab's tab group.
 *
 * For native tab groups, adds the tab to the specified group.
 *
 */
export async function setTabTgroup(name: string, id?: number | number[]) {
    const ids = await tabIdsOrCurrent(id)

    if (hasNativeTabGroups()) {
        const windowId = await activeWindowId()
        const groupId = await getOrCreateGroupId(name, windowId)
        return browserBg.tabs.group({
            tabIds: ids,
            groupId,
        })
    }

    return Promise.all(
        ids.map(id => {
            browserBg.sessions.setTabValue(id, "tridactyl-tgroup", name)
        }),
    )
}

/**
 * Clear all the tab groups for specific tabs.
 *
 */
export async function clearTabTgroup(id?: number | number[]) {
    const ids = await tabIdsOrCurrent(id)

    if (hasNativeTabGroups()) {
        // Ungroup tabs
        return browserBg.tabs.ungroup(ids)
    }

    return Promise.all(
        ids.map(id => {
            browserBg.sessions.removeTabValue(id, "tridactyl-tgroup")
        }),
    )
}

/**
 * Return a list of all tabs in a tab group.
 *
 * @param name The name of the tab group.
 * @param other Whether to return the tabs not in the tab group instead.
 * @param id The id of the window. Use the current window if not specified.
 *
 */
export async function tgroupTabs(
    name: string,
    other = false,
    id?: number,
): Promise<browser.tabs.Tab[]> {
    if (id === undefined) {
        id = await activeWindowId()
    }

    if (hasNativeTabGroups()) {
        const groupId = await getGroupIdFromName(name, id)
        if (groupId === undefined) {
            return other ? await browserBg.tabs.query({ windowId: id }) : []
        }

        const allTabs = await browserBg.tabs.query({ windowId: id })
        const groupTabs = await browserBg.tabs.query({
            windowId: id,
            groupId,
        })
        const groupTabIds = new Set(groupTabs.map(t => t.id))

        return allTabs.filter(tab =>
            other ? !groupTabIds.has(tab.id) : groupTabIds.has(tab.id),
        )
    }

    return browserBg.tabs.query({ windowId: id }).then(async tabs => {
        const sameGroupIndices = await Promise.all(
            tabs.map(async ({ id }) => {
                const groupMatched = (await tabTgroup(id)) == name
                return other ? !groupMatched : groupMatched
            }),
        )
        tabs = tabs.filter((_, index) => sameGroupIndices[index])
        return tabs
    })
}

/**
 * Return the id of the last selected tab in a tab group.
 *
 */
export async function tgroupLastTabId(name: string, previous = false) {
    const tabs = await tgroupTabs(name)
    tabs.sort((a, b) => b.lastAccessed - a.lastAccessed)
    if (previous) {
        return tabs[1].id
    } else {
        return tabs[0].id
    }
}

/**
 * Clear stored information for a tab group.
 *
 */
export async function tgroupClearOldInfo(
    oldName: string,
    newName?: string,
    id?: number,
) {
    const promises = []
    const groups = await tgroups()
    groups.delete(oldName)
    if (newName) {
        groups.add(newName)
    }
    promises.push(setTgroups(groups))

    if (id === undefined) {
        id = await activeWindowId()
    }

    if (newName) {
        promises.push(setWindowTgroup(newName, id))
        promises.push(
            tgroupTabs(oldName, false, id).then(tabs => {
                setTabTgroup(
                    newName,
                    tabs.map(tab => tab.id),
                )
            }),
        )
    }
    return Promise.all(promises)
}

/**
 * Activate the previously active tab in a tab group.
 *
 */
export async function tgroupActivate(name: string) {
    const lastActiveTabId = await tgroupLastTabId(name)
    return browserBg.tabs.update(lastActiveTabId, { active: true })
}

/**
 * Activate the last active tab in the last active tab group.
 *
 * Return the name of activated tab group.
 *
 */
export async function tgroupActivateLast() {
    const lastTabGroup = await windowLastTgroup()
    return tgroupActivate(lastTabGroup).then(() => lastTabGroup)
}

/**
 * Clear all stored tab group information.
 *
 */
export async function clearAllTgroupInfo() {
    if (hasNativeTabGroups()) {
        // For native groups, ungroup all tabs in the window
        const windowId = await activeWindowId()
        const tabs = await browserBg.tabs.query({ windowId })
        const tabIds = tabs
            .map(t => t.id)
            .filter((id): id is number => id !== undefined)
        await browserBg.tabs.ungroup(tabIds)
        return
    }

    return Promise.all([
        clearTgroups(),
        clearWindowTgroup(),
        browser.tabs.query({ currentWindow: true }).then(async tabs => {
            const ids = tabs.map(tab => tab.id)
            await browser.tabs.show(ids)
            return clearTabTgroup(ids)
        }),
    ])
}

/**
 * Set the tab's tab group to its window's active tab group if there is one.
 *
 * Do nothing if the tab is already associated with a tab group.
 *
 */
export async function tgroupHandleTabCreated(tab: browser.tabs.Tab) {
    const windowGroup = await windowTgroup(tab.windowId)

    if (windowGroup) {
        const tabGroup = await tabTgroup(tab.id)
        if (!tabGroup) {
            return setTabTgroup(windowGroup, tab.id)
        }
    }
}

/**
 * Set the tab's tab group to its window's active tab group if there is one.
 *
 */
export async function tgroupHandleTabAttached(tabId: number, attachInfo) {
    const windowGroup = await windowTgroup(attachInfo.newWindowId)
    if (windowGroup) {
        return setTabTgroup(windowGroup, tabId)
    }
}

/**
 * Handle tab activation, possibly switching tab groups.
 *
 * If the new tab is from a different tab group, switch to it.
 *
 */
export async function tgroupHandleTabActivated(activeInfo) {
    if (hasNativeTabGroups()) {
        // Native tab groups handle group switching automatically
        return
    }

    const windowGroup = await windowTgroup(activeInfo.windowId)
    const tabGroup = await tabTgroup(activeInfo.tab)
    const promises = []
    if (windowGroup && tabGroup && windowGroup != tabGroup) {
        await setWindowTgroup(tabGroup, activeInfo.windowId)

        promises.push(
            tgroupTabs(tabGroup, false, activeInfo.windowId).then(tabs =>
                browserBg.tabs.show(tabs.map(tab => tab.id)),
            ),
        )
        promises.push(
            tgroupTabs(tabGroup, true, activeInfo.windowId).then(tabs =>
                browserBg.tabs.hide(tabs.map(tab => tab.id)),
            ),
        )
    }
    return Promise.all(promises)
}

/**
 * Set or clear a tab's group if it was pinned or unpinned respectively.
 *
 */
export async function tgroupHandleTabUpdated(
    tabId: number,
    changeInfo,
    tab: browser.tabs.Tab,
) {
    if (changeInfo.pinned !== undefined) {
        const windowGroup = await windowTgroup(tab.windowId)
        if (windowGroup) {
            if (changeInfo.pinned) {
                return clearTabTgroup(tabId)
            } else {
                return setTabTgroup(windowGroup, tabId)
            }
        }
    }
}

/**
 * Handle the last tab in a tab group being closed.
 *
 * Clear its information.
 *
 */
export async function tgroupHandleTabRemoved(_tabId: number, removeInfo) {
    if (!removeInfo.isWindowClosing) {
        const windowGroup = await windowTgroup(removeInfo.windowId)
        const tabCount = await tgroupTabs(
            windowGroup,
            false,
            removeInfo.windowId,
        ).then(tabs => tabs.length)
        if (tabCount == 0) {
            return tgroupClearOldInfo(
                windowGroup,
                undefined,
                removeInfo.windowId,
            )
        }
    }
}

/**
 * Handle the last tab in a tab group being moved to another window.
 *
 * Clear its information.
 *
 */
export async function tgroupHandleTabDetached(tabId: number, detachInfo) {
    // clear tab's stored group; will automatically be changed if there are
    // groups on the other window but otherwise it will still show up in the
    // mode indicator
    clearTabTgroup(tabId)

    const windowGroup = await windowTgroup(detachInfo.oldWindowId)
    const tabCount = await tgroupTabs(
        windowGroup,
        false,
        detachInfo.oldWindowId,
    ).then(tabs => tabs.length)
    if (tabCount == 0) {
        return tgroupClearOldInfo(
            windowGroup,
            undefined,
            detachInfo.oldWindowId,
        )
    }
}
