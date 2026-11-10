/*
 * Rosoen student resources
 * Loads resources.json and builds the lesson, version, and download choices.
 * A download link is only created when a file is marked available AND the site
 * confirms that the file exists (or it is an external link marked available).
 */
(function () {
  "use strict";

  const DATA_URL = "resources.json";

  // Fallbacks used only if resources.json cannot be read.
  const DEFAULT_EXAM = "📚 Your exam is next week! Continue practising every day, review your lesson materials, and focus on the topics you find most challenging. Use the resources below to prepare and build your confidence.";
  const DEFAULT_REMINDER = "Keep practising! Review one topic at a time, test yourself, and revisit any questions you get wrong.";
  const DEFAULT_COMING_SOON = "🎙️ Your recorded lesson is being uploaded. Please check back in a few minutes. In the meantime, download the available materials and continue practising for next week’s exam.";

  // The four student choices. Recording and notes options only appear when a lesson supports them.
  const VERSIONS = [
    { key: "slides", label: "Without recording, without speaker notes", hint: "The presentation only.", recording: false, notes: false },
    { key: "slides-notes", label: "Without recording, with speaker notes", hint: "The presentation with speaker notes included.", recording: false, notes: true },
    { key: "recording", label: "With recording, without speaker notes", hint: "The presentation, plus a separate recording video.", recording: true, notes: false },
    { key: "recording-notes", label: "With recording, with speaker notes", hint: "The presentation with speaker notes, plus a separate recording video.", recording: true, notes: true }
  ];

  const state = {
    data: null,        // parsed resources.json
    lessonId: null,    // selected lesson id
    versionKey: "slides",
    checks: {},        // file path -> "ok" | "missing" | "unknown"
    checkedAt: null,
    loading: false
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    banner: $("examBanner"),
    bannerText: $("examText"),
    lessonList: $("lessonList"),
    versions: $("versions"),
    versionList: $("versionList"),
    downloads: $("downloads"),
    panel: $("downloadPanel"),
    reminder: $("studyReminder"),
    message: $("loadMessage"),
    checked: $("lastChecked"),
    updated: $("updatedNote"),
    live: $("liveRegion")
  };

  /* ---------- helpers ---------- */

  // Small DOM builder. Text is always set with textContent, so content from JSON is never parsed as HTML.
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([name, value]) => {
      if (value === false || value === null || value === undefined) return;
      if (name === "text") node.textContent = value;
      else if (name.startsWith("on") && typeof value === "function") node.addEventListener(name.slice(2), value);
      else if (value === true) node.setAttribute(name, "");
      else node.setAttribute(name, String(value));
    });
    (children || []).forEach((child) => {
      if (child === false || child === null || child === undefined) return;
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    });
    return node;
  }

  const hasPath = (p) => typeof p === "string" && p.trim() !== "";
  const isExternal = (p) => /^https?:\/\//i.test(p || "");

  function formatDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    if (!m) return iso || "";
    const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  const formatTime = (date) => date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  const lessons = () => (state.data && state.data.lessons) || [];
  const lessonById = (id) => lessons().find((l) => l.id === id) || null;
  const currentLesson = () => lessonById(state.lessonId);
  const versionDef = (key) => VERSIONS.find((v) => v.key === key) || VERSIONS[0];
  const notesEnabled = (lesson) => Boolean(lesson.speakerNotes) && lesson.speakerNotes.status === "student_accessible";
  const statusPill = (text, tone) => el("span", { class: "status status-" + tone, text: text });

  // "none" means the recording choices are hidden for that lesson.
  function recordingStatus(lesson) {
    const s = lesson.recording && lesson.recording.status;
    return s === "available" || s === "coming_soon" ? s : "none";
  }

  function versionsFor(lesson) {
    return VERSIONS.filter((v) => {
      if (v.recording && recordingStatus(lesson) === "none") return false;
      if (v.notes && !notesEnabled(lesson)) return false;
      return true;
    });
  }

  const comingSoonText = () => (state.data && state.data.comingSoonMessage) || DEFAULT_COMING_SOON;

  /* ---------- data loading and file checks ---------- */

  function cleanLessons(data) {
    if (!data || !Array.isArray(data.lessons)) {
      throw new Error('resources.json needs a "lessons" list.');
    }
    const seen = new Set();
    return data.lessons.filter((lesson) => {
      const valid = lesson && typeof lesson.id === "string" && lesson.id !== "" &&
        typeof lesson.title === "string" && !seen.has(lesson.id);
      if (!valid) {
        console.warn("Rosoen: skipped a lesson with a missing or duplicate id or title.", lesson);
        return false;
      }
      seen.add(lesson.id);
      return true;
    });
  }

  // Every local file that could become a download, so each one is confirmed before it is offered.
  function filesToCheck(list) {
    const paths = new Set();
    const add = (p) => { if (hasPath(p) && !isExternal(p)) paths.add(p); };
    list.forEach((lesson) => {
      if (lesson.presentation && lesson.presentation.available === true) add(lesson.presentation.path);
      if (notesEnabled(lesson) && lesson.speakerNotes.available === true) add(lesson.speakerNotes.path);
      if (recordingStatus(lesson) === "available") add(lesson.recording.path);
      (lesson.handouts || []).forEach((h) => { if (h && h.available === true) add(h.path); });
    });
    return [...paths];
  }

  // A HEAD request confirms that a file exists without downloading it.
  function checkFiles(paths) {
    const results = {};
    return Promise.all(paths.map((p) =>
      fetch(encodeURI(p), { method: "HEAD", cache: "no-store" })
        .then((res) => { results[p] = res.ok ? "ok" : "missing"; })
        .catch(() => { results[p] = "unknown"; })
    )).then(() => results);
  }

  // Decides what a download card can show. A link only comes from an available, confirmed file.
  function fileState(path, isAvailable) {
    if (!isAvailable || !hasPath(path)) return { status: "coming_soon" };
    if (isExternal(path)) return { status: "ready", href: path, external: true };
    const check = state.checks[path];
    if (check === "ok") return { status: "ready", href: encodeURI(path), external: false };
    if (check === "missing") return { status: "missing" };
    if (check === "unknown") return { status: "unknown" };
    return { status: "checking" };
  }

  function loadResources() {
    if (state.loading) return;
    const hadFocus = Boolean(document.activeElement && document.activeElement.hasAttribute("data-refresh"));
    setLoading(true);

    return fetch(DATA_URL + "?t=" + Date.now(), { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("resources.json returned HTTP " + res.status);
        return res.json();
      })
      .then((data) => {
        data.lessons = cleanLessons(data);
        state.data = data;
        return checkFiles(filesToCheck(data.lessons));
      })
      .then((checks) => {
        state.checks = checks;
        state.checkedAt = new Date();
        setLoading(false);
        setMessage("");
        renderAll();
        announce("Resource list updated.");
      })
      .catch((err) => {
        console.error("Rosoen student resources:", err);
        setLoading(false);
        setMessage(
          state.data
            ? "We could not refresh the list just now, so the last list we loaded is shown."
            : "We could not load the lesson list. Select Refresh availability to try again.",
          true
        );
        renderAll();
        announce("The lesson list could not be loaded.");
      })
      .finally(() => {
        if (hadFocus) {
          const button = document.querySelector("#lessons [data-refresh]");
          if (button) button.focus();
        }
      });
  }

  function setLoading(on) {
    state.loading = on;
    document.querySelectorAll("[data-refresh]").forEach((b) => { b.disabled = on; });
    if (on) els.checked.textContent = "Checking files...";
  }

  function setMessage(text, isError) {
    els.message.textContent = text;
    els.message.hidden = !text;
    els.message.classList.toggle("is-error", Boolean(isError));
  }

  function announce(text) {
    els.live.textContent = text;
  }

  /* ---------- rendering ---------- */

  function renderAll() {
    const data = state.data || {};
    applyExamReminder(data.examReminder);
    els.reminder.textContent = data.studyReminder || DEFAULT_REMINDER;
    els.updated.textContent = data.lastUpdated ? "Materials last updated " + formatDate(data.lastUpdated) + "." : "";

    ensureSelection();
    renderLessons();

    const lesson = currentLesson();
    els.versions.hidden = !lesson;
    els.downloads.hidden = !lesson;
    if (lesson) {
      renderVersions(lesson);
      renderDownloads(lesson);
    }
    els.checked.textContent = state.checkedAt ? "Last checked " + formatTime(state.checkedAt) : "";
  }

  function applyExamReminder(reminder) {
    const text = reminder && typeof reminder.text === "string" && reminder.text.trim() ? reminder.text : DEFAULT_EXAM;
    els.bannerText.textContent = text;
    els.banner.hidden = Boolean(reminder) && reminder.show === false;
  }

  function ensureSelection() {
    const lesson = currentLesson();
    if (!lesson) {
      state.lessonId = null;
      return;
    }
    const allowed = versionsFor(lesson).map((v) => v.key);
    if (!allowed.includes(state.versionKey)) state.versionKey = "slides";
  }

  function lessonTags(lesson) {
    const tags = [];
    if (lesson.presentation && lesson.presentation.available === true) {
      tags.push(el("span", { class: "tag", text: "PowerPoint" }));
    }
    if (notesEnabled(lesson)) tags.push(el("span", { class: "tag tag-purple", text: "Speaker notes" }));
    const rec = recordingStatus(lesson);
    if (rec === "available") tags.push(el("span", { class: "tag", text: "Recording" }));
    if (rec === "coming_soon") tags.push(el("span", { class: "tag tag-soon", text: "Recording coming soon" }));
    return tags;
  }

  function renderLessons() {
    const box = els.lessonList;
    box.textContent = "";
    box.appendChild(el("legend", { class: "visually-hidden", text: "Lessons" }));
    if (!state.data) return;

    const list = lessons();
    if (!list.length) {
      box.appendChild(el("p", { class: "notice", text: "No lessons are published yet." }));
      return;
    }

    list.forEach((lesson, i) => {
      const id = "lesson-" + i;
      box.appendChild(el("div", { class: "choice" }, [
        el("input", {
          type: "radio",
          name: "lesson",
          id: id,
          class: "choice-input",
          checked: lesson.id === state.lessonId,
          onchange: () => selectLesson(lesson.id)
        }),
        el("label", { class: "choice-card", for: id }, [
          el("span", { class: "choice-title", text: lesson.title }),
          lesson.description ? el("span", { class: "choice-desc", text: lesson.description }) : false,
          el("span", { class: "tag-row" }, lessonTags(lesson)),
          lesson.lastUpdated ? el("span", { class: "meta meta-block", text: "Last updated " + formatDate(lesson.lastUpdated) }) : false
        ])
      ]));
    });
  }

  function renderVersions(lesson) {
    const box = els.versionList;
    box.textContent = "";
    box.appendChild(el("legend", { class: "visually-hidden", text: "Versions" }));
    versionsFor(lesson).forEach((v) => {
      const id = "version-" + v.key;
      box.appendChild(el("div", { class: "choice" }, [
        el("input", {
          type: "radio",
          name: "version",
          id: id,
          class: "choice-input",
          checked: v.key === state.versionKey,
          onchange: () => selectVersion(v.key)
        }),
        el("label", { class: "choice-card", for: id }, [
          el("span", { class: "choice-title", text: v.label }),
          el("span", { class: "choice-desc", text: v.hint })
        ])
      ]));
    });
  }

  function renderDownloads(lesson) {
    const version = versionDef(state.versionKey);
    const pres = lesson.presentation || {};
    const notes = lesson.speakerNotes || {};
    const cards = [];

    // Speaker-note versions use the notes file in place of the plain presentation.
    if (version.notes) {
      cards.push(fileCard({
        kind: "notes",
        format: notes.fileType || "PowerPoint with speaker notes (.pptx)",
        title: "Presentation with speaker notes",
        desc: "The slides with the speaker notes included in the file.",
        file: fileState(notes.path, notes.available === true),
        updated: notes.lastUpdated,
        button: "Download speaker notes version"
      }));
    } else {
      cards.push(fileCard({
        kind: "slides",
        format: pres.fileType || "PowerPoint (.pptx)",
        title: "Presentation",
        desc: "The slides only, without speaker notes.",
        file: fileState(pres.path, pres.available === true),
        updated: pres.lastUpdated,
        button: "Download presentation"
      }));
    }

    // The recording is always a separate card, never implied to hold the slides or notes.
    if (version.recording) cards.push(recordingCard(lesson));

    (lesson.handouts || []).forEach((h) => {
      if (!h || h.available !== true) return;
      cards.push(fileCard({
        kind: "handout",
        format: h.fileType || "PDF",
        title: h.title || "Handout",
        desc: h.description || "A printable handout.",
        file: fileState(h.path, true),
        updated: h.lastUpdated,
        button: "Download handout"
      }));
    });

    els.panel.textContent = "";
    els.panel.classList.toggle("two-up", cards.length > 1);
    els.panel.appendChild(el("div", { class: "summary" }, [
      el("p", { class: "summary-label", text: "Your selection" }),
      el("p", { class: "summary-value", text: lesson.title }),
      el("p", { class: "summary-sub", text: version.label })
    ]));
    cards.forEach((card) => els.panel.appendChild(card));
  }

  function fileCard(o) {
    const kids = [
      el("div", { class: "dl-head" }, [
        el("span", { class: "format format-" + o.kind, text: o.format }),
        el("h3", { class: "dl-title", text: o.title })
      ]),
      el("p", { class: "dl-desc", text: o.desc })
    ];
    if (o.updated) kids.push(el("p", { class: "meta", text: "Last updated " + formatDate(o.updated) }));
    kids.push(fileAction(o.file, o.button));
    return el("article", { class: "dl-card" }, kids);
  }

  // The only place a download link is created. Anything not confirmed gets a status message instead.
  function fileAction(file, label) {
    const wrap = (children) => el("div", { class: "action" }, children);

    if (file.status === "ready") {
      const attrs = { class: "btn btn-download", href: file.href };
      if (file.external) {
        attrs.target = "_blank";
        attrs.rel = "noopener";
      } else {
        attrs.download = true;
      }
      return wrap([el("a", attrs, [label])]);
    }
    if (file.status === "coming_soon") {
      return wrap([statusPill("Coming soon", "soon")]);
    }
    if (file.status === "missing") {
      return wrap([
        statusPill("Not on the site yet", "warn"),
        el("p", { class: "dl-note", text: "This file has not reached the site yet. Please check back soon." })
      ]);
    }
    if (file.status === "unknown") {
      return wrap([
        statusPill("Could not confirm", "warn"),
        el("p", { class: "dl-note", text: "Select Refresh availability to try again." })
      ]);
    }
    return wrap([statusPill("Checking...", "soon")]);
  }

  function recordingCard(lesson) {
    const rec = lesson.recording || {};
    const format = rec.fileType || "MP4 video";
    const title = "Lesson recording";
    const desc = "A separate video. It does not contain the slides or the speaker notes.";

    if (recordingStatus(lesson) === "coming_soon") {
      return el("article", { class: "dl-card" }, [
        el("div", { class: "dl-head" }, [
          el("span", { class: "format format-video", text: format }),
          el("h3", { class: "dl-title", text: title })
        ]),
        el("p", { class: "dl-desc", text: desc }),
        el("div", { class: "action" }, [statusPill("Coming soon", "soon")]),
        el("div", { class: "soon-box" }, [
          el("p", { text: comingSoonText() }),
          el("button", { type: "button", class: "btn btn-secondary", "data-refresh": true, text: "Refresh availability" })
        ])
      ]);
    }

    const file = fileState(rec.path, true);
    return fileCard({
      kind: "video",
      format: format,
      title: title,
      desc: desc,
      file: file,
      updated: rec.lastUpdated,
      button: file.external ? "Open recording" : "Download recording"
    });
  }

  /* ---------- actions ---------- */

  function selectLesson(id) {
    state.lessonId = id;
    const lesson = currentLesson();
    if (!lesson) return;
    const allowed = versionsFor(lesson).map((v) => v.key);
    if (!allowed.includes(state.versionKey)) state.versionKey = "slides";
    els.versions.hidden = false;
    els.downloads.hidden = false;
    renderVersions(lesson);
    renderDownloads(lesson);
    announce(lesson.title + " selected. Choose a version.");
  }

  function selectVersion(key) {
    state.versionKey = key;
    const lesson = currentLesson();
    if (lesson) renderDownloads(lesson);
    announce(versionDef(key).label + " selected.");
  }

  /* ---------- text size (chosen by the student) ---------- */

  const TEXT_SIZE_KEY = "rosoenTextSize";
  const TEXT_SIZE_LABELS = { small: "Small", medium: "Medium", large: "Large", xlarge: "Extra large" };

  function setTextSize(size, shouldAnnounce) {
    if (!Object.prototype.hasOwnProperty.call(TEXT_SIZE_LABELS, size)) size = "small";
    document.documentElement.setAttribute("data-text-size", size);
    document.querySelectorAll("[data-size]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.getAttribute("data-size") === size));
    });
    try {
      localStorage.setItem(TEXT_SIZE_KEY, size);
    } catch (err) {
      // Storage can be blocked in private browsing. The size still applies for this visit.
    }
    if (shouldAnnounce) announce("Text size set to " + TEXT_SIZE_LABELS[size] + ".");
  }

  let savedSize = "small";
  try {
    savedSize = localStorage.getItem(TEXT_SIZE_KEY) || "small";
  } catch (err) {
    // Ignore; the default size is used.
  }
  setTextSize(savedSize, false);

  document.querySelectorAll("[data-size]").forEach((button) => {
    button.addEventListener("click", () => setTextSize(button.getAttribute("data-size"), true));
  });

  // One listener handles every Refresh availability button, including ones built later.
  document.addEventListener("click", (event) => {
    const button = event.target.closest && event.target.closest("[data-refresh]");
    if (button && !button.disabled) {
      event.preventDefault();
      loadResources();
    }
  });

  loadResources();
})();
