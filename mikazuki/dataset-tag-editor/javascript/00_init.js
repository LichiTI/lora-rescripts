function gradioApp() {
    const elems = document.getElementsByTagName('gradio-app')
    const elem = elems.length == 0 ? document : elems[0]

    if (elem !== document) elem.getElementById = function(id){ return document.getElementById(id) }
    return elem.shadowRoot ? elem.shadowRoot : elem
}

function restart_reload(){
    document.body.innerHTML='<h1 style="font-family:monospace;margin-top:20%;color:lightgray;text-align:center;">Reloading...</h1>';
    setTimeout(function(){location.reload()},2000)

    return []
}

var uiUpdateCallbacks = [];
var themeSyncObserver = null;
var mediaThemeQuery = null;
var THEME_SYNC_VARIABLES = [
    "--c-bg",
    "--c-bg-soft",
    "--c-bg-mute",
    "--c-border",
    "--c-border-dark",
    "--c-text-1",
    "--c-text-2",
    "--c-text-3",
    "--c-brand",
    "--c-brand-dark",
    "--el-color-primary"
];

function onUiUpdate(callback) {
    uiUpdateCallbacks.push(callback);
}

function executeCallbacks(queue, arg) {
    for (const callback of queue) {
        try {
            callback(arg);
        } catch (e) {
            console.error("error running callback", callback, ":", e);
        }
    }
}

function getThemeSourceRoot() {
    try {
        if (window.parent && window.parent !== window && window.parent.document) {
            return window.parent.document.documentElement;
        }
    } catch (e) {
        console.debug("parent theme root unavailable", e);
    }

    return null;
}

function getStoredThemeMode() {
    const userMode = localStorage.getItem("vuepress-color-scheme");
    const systemDarkMode = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    return userMode === "dark" || (userMode !== "light" && systemDarkMode) ? "dark" : "light";
}

function copyThemeVariables(source, target) {
    if (!source || !target) {
        return;
    }

    const style = getComputedStyle(source);
    for (const name of THEME_SYNC_VARIABLES) {
        const value = style.getPropertyValue(name);
        if (value && value.trim()) {
            target.style.setProperty(name, value.trim());
        }
    }
}

function applyThemeMode(mode) {
    const isDark = mode === "dark";
    const elems = document.getElementsByTagName("gradio-app");

    document.documentElement.classList.toggle("dark", isDark);
    document.body.classList.toggle("dark", isDark);
    document.documentElement.dataset.theme = mode;
    document.body.dataset.theme = mode;
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";

    for (const elem of elems) {
        elem.classList.toggle("dark", isDark);
        elem.dataset.theme = mode;

        if (elem.shadowRoot && elem.shadowRoot.host) {
            elem.shadowRoot.host.classList.toggle("dark", isDark);
            elem.shadowRoot.host.dataset.theme = mode;
        }
    }
}

function syncThemeFromParent() {
    const sourceRoot = getThemeSourceRoot();

    if (sourceRoot) {
        copyThemeVariables(sourceRoot, document.documentElement);
        applyThemeMode(sourceRoot.classList.contains("dark") ? "dark" : "light");
        return;
    }

    applyThemeMode(getStoredThemeMode());
}

function observeThemeChanges() {
    syncThemeFromParent();

    const sourceRoot = getThemeSourceRoot();
    if (sourceRoot && !themeSyncObserver) {
        themeSyncObserver = new MutationObserver(function () {
            syncThemeFromParent();
        });
        themeSyncObserver.observe(sourceRoot, {
            attributes: true,
            attributeFilter: ["class", "style"]
        });
    }

    if (window.matchMedia && !mediaThemeQuery) {
        mediaThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
        if (mediaThemeQuery.addEventListener) {
            mediaThemeQuery.addEventListener("change", syncThemeFromParent);
        } else if (mediaThemeQuery.addListener) {
            mediaThemeQuery.addListener(syncThemeFromParent);
        }
    }
}

document.addEventListener("DOMContentLoaded", function() {
    observeThemeChanges();

    var mutationObserver = new MutationObserver(function(m) {
        syncThemeFromParent();
        executeCallbacks(uiUpdateCallbacks, m);
    });
    mutationObserver.observe(gradioApp(), {childList: true, subtree: true});
});

window.addEventListener("storage", function (event) {
    if (event.key === "vuepress-color-scheme") {
        syncThemeFromParent();
    }
});

// localization = {} -- the dict with translations is created by the backend

var ignore_ids_for_localization = {};

var re_num = /^[.\d]+$/;
var re_emoji = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{1F9B0}-\u{1F9B3}]/u;

var original_lines = {};
var translated_lines = {};

function hasLocalization() {
    return window.localization && Object.keys(window.localization).length > 0;
}

function textNodesUnder(el) {
    var n, a = [], walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
    while ((n = walk.nextNode())) a.push(n);
    return a;
}

function canBeTranslated(node, text) {
    if (!text) return false;
    if (!node.parentElement) return false;

    var parentType = node.parentElement.nodeName;
    if (parentType == 'SCRIPT' || parentType == 'STYLE' || parentType == 'TEXTAREA') return false;

    if (parentType == 'OPTION' || parentType == 'SPAN') {
        var pnode = node;
        for (var level = 0; level < 4; level++) {
            pnode = pnode.parentElement;
            if (!pnode) break;

            if (ignore_ids_for_localization[pnode.id] == parentType) return false;
        }
    }

    if (re_num.test(text)) return false;
    if (re_emoji.test(text)) return false;
    return true;
}

function getTranslation(text) {
    if (!text) return undefined;

    if (translated_lines[text] === undefined) {
        original_lines[text] = 1;
    }

    var tl = localization[text];
    if (tl !== undefined) {
        translated_lines[tl] = 1;
    }

    return tl;
}

function processTextNode(node) {
    var text = node.textContent.trim();

    if (!canBeTranslated(node, text)) return;

    var tl = getTranslation(text);
    if (tl !== undefined) {
        node.textContent = tl;
    }
}

function processNode(node) {
    if (node.nodeType == 3) {
        processTextNode(node);
        return;
    }

    if (node.title) {
        let tl = getTranslation(node.title);
        if (tl !== undefined) {
            node.title = tl;
        }
    }

    if (node.placeholder) {
        let tl = getTranslation(node.placeholder);
        if (tl !== undefined) {
            node.placeholder = tl;
        }
    }

    textNodesUnder(node).forEach(function (node) {
        processTextNode(node);
    });
}

function localizeWholePage() {
    processNode(gradioApp());

    function elem(comp) {
        var elem_id = comp.props.elem_id ? comp.props.elem_id : "component-" + comp.id;
        return gradioApp().getElementById(elem_id);
    }

    if (!window.gradio_config || !window.gradio_config.components) return;

    for (var comp of window.gradio_config.components) {
        if (comp.props.webui_tooltip) {
            let e = elem(comp);

            let tl = e ? getTranslation(e.title) : undefined;
            if (tl !== undefined) {
                e.title = tl;
            }
        }
        if (comp.props.placeholder) {
            let e = elem(comp);
            let textbox = e ? e.querySelector('[placeholder]') : null;

            let tl = textbox ? getTranslation(textbox.placeholder) : undefined;
            if (tl !== undefined) {
                textbox.placeholder = tl;
            }
        }
    }
}

document.addEventListener("DOMContentLoaded", function () {
    if (!hasLocalization()) {
        return;
    }

    onUiUpdate(function (m) {
        m.forEach(function (mutation) {
            mutation.addedNodes.forEach(function (node) {
                processNode(node);
            });
        });
    });

    localizeWholePage();
});
