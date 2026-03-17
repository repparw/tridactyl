import { hasNativeTabGroups } from "./tab_groups"

// Mock browser API
const mockBrowser = {
    tabs: {
        group: undefined,
        ungroup: undefined,
    },
    tabGroups: undefined,
}

beforeEach(() => {
    // Reset mocks
    mockBrowser.tabs.group = undefined
    mockBrowser.tabGroups = undefined
})

describe("hasNativeTabGroups", () => {
    it("returns false when browser.tabGroups is undefined", () => {
        // Mock browserBg to return our mock
        jest.mock("./webext", () => ({
            browserBg: mockBrowser,
        }))

        // Since hasNativeTabGroups uses browserBg from webext, we need to reset the module
        jest.resetModules()
        const { hasNativeTabGroups } = require("./tab_groups")
        expect(hasNativeTabGroups()).toBe(false)
    })

    it("returns false when browser.tabs.group is undefined", () => {
        mockBrowser.tabGroups = { query: jest.fn() }
        // browser.tabs.group is still undefined

        jest.resetModules()
        const { hasNativeTabGroups } = require("./tab_groups")
        expect(hasNativeTabGroups()).toBe(false)
    })

    it("returns true when both browser.tabGroups and browser.tabs.group exist", () => {
        mockBrowser.tabGroups = { query: jest.fn() }
        mockBrowser.tabs.group = jest.fn()

        jest.resetModules()
        const { hasNativeTabGroups } = require("./tab_groups")
        expect(hasNativeTabGroups()).toBe(true)
    })
})

// Test that the legacy implementation functions exist and don't throw
describe("Legacy implementation fallback", () => {
    // Note: We can't fully test the legacy implementation without extensive mocking
    // but we can at least verify the functions exist and have correct signatures
    it("tgroups function exists", async () => {
        jest.resetModules()
        const { tgroups } = require("./tab_groups")
        expect(typeof tgroups).toBe("function")
    })

    it("setTgroups function exists", async () => {
        jest.resetModules()
        const { setTgroups } = require("./tab_groups")
        expect(typeof setTgroups).toBe("function")
    })

    it("windowTgroup function exists", async () => {
        jest.resetModules()
        const { windowTgroup } = require("./tab_groups")
        expect(typeof windowTgroup).toBe("function")
    })

    it("tabTgroup function exists", async () => {
        jest.resetModules()
        const { tabTgroup } = require("./tab_groups")
        expect(typeof tabTgroup).toBe("function")
    })

    it("setTabTgroup function exists", async () => {
        jest.resetModules()
        const { setTabTgroup } = require("./tab_groups")
        expect(typeof setTabTgroup).toBe("function")
    })

    it("tgroupTabs function exists", async () => {
        jest.resetModules()
        const { tgroupTabs } = require("./tab_groups")
        expect(typeof tgroupTabs).toBe("function")
    })
})
