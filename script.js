(function () {
  "use strict";

  /* ---------- Helpers ---------- */
  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) =>
    Array.from((root || document).querySelectorAll(selector));

  function readStore(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch (e) {
      return [];
    }
  }
  function writeStore(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* storage unavailable */
    }
  }

  function showMessage(text, type) {
    const box = document.createElement("div");
    box.setAttribute("role", "status");
    box.textContent = text;
    box.style.cssText =
      "position:fixed;right:20px;bottom:20px;z-index:50;max-width:320px;padding:12px 16px;" +
      "border-radius:8px;color:#fff;font-size:14px;font-weight:700;box-shadow:0 4px 14px rgba(0,0,0,.15);" +
      "background:" +
      (type === "error" ? "#c0392b" : "#248453");
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 3200);
  }

  function cellText(row, index) {
    return row.cells[index]
      ? row.cells[index].textContent.trim().toLowerCase()
      : "";
  }

  function td(text) {
    const cell = document.createElement("td");
    cell.textContent = text;
    return cell;
  }
  function badgeCell(text, className) {
    const cell = document.createElement("td");
    const span = document.createElement("span");
    span.className = className;
    span.textContent = text;
    cell.appendChild(span);
    return cell;
  }
  function actionCell() {
    const cell = document.createElement("td");
    ["View", "Edit"].forEach((label, i) => {
      const a = document.createElement("a");
      a.className = "row-action";
      a.href = "#";
      a.textContent = label;
      cell.appendChild(a);
      if (i === 0) cell.appendChild(document.createTextNode(" \u00a0 "));
    });
    return cell;
  }

  // Filter forms in the toolbar should never reload the page.
  $$(".toolbar").forEach((form) =>
    form.addEventListener("submit", (e) => e.preventDefault()),
  );

  // Show a message saved before a redirect (for example "Student saved").
  try {
    const flash = localStorage.getItem("academyos_flash");
    if (flash) {
      localStorage.removeItem("academyos_flash");
      showMessage(flash);
    }
  } catch (e) {
    /* ignore */
  }

  /* ---------- 1. Login redirect ---------- */
  const loginForm = $(".login-card form");
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const role = $("#role").value;
      // Prototype only: real authentication comes from the backend later.
      try {
        localStorage.setItem("academyos_role", role);
      } catch (err) {
        /* ignore */
      }
      window.location.href =
        role === "teacher" ? "pages/teacher-dashboard.html" : "index.html";
    });
  }

  /* ---------- 2. Search and filters (Students, Staff, Fees) ---------- */
  function setupFilter(config) {
    const search = $(config.search);
    if (!search) return;
    const selects = config.selects.map((s) => ({
      el: $(s.selector),
      column: s.column,
      all: s.all,
    }));
    const tbody = $(".students-table tbody");
    if (!tbody) return;

    function apply() {
      const term = search.value.trim().toLowerCase();
      let visible = 0;
      $$("tr", tbody).forEach((row) => {
        if (row.dataset.empty) return;
        const textMatch =
          !term ||
          config.searchColumns.some((c) => cellText(row, c).includes(term));
        const selectMatch = selects.every((s) => {
          if (!s.el) return true;
          const value = s.el.value.toLowerCase();
          return value === s.all || cellText(row, s.column).includes(value);
        });
        const show = textMatch && selectMatch;
        row.hidden = !show;
        if (show) visible++;
      });
      showEmptyRow(tbody, visible === 0, config.columns);
    }

    search.addEventListener("input", apply);
    selects.forEach((s) => s.el && s.el.addEventListener("change", apply));
  }

  function showEmptyRow(tbody, isEmpty, columns) {
    let row = $("tr[data-empty]", tbody);
    if (isEmpty && !row) {
      row = document.createElement("tr");
      row.dataset.empty = "true";
      const cell = td(
        "No records match your search. Clear the filters to see all records.",
      );
      cell.colSpan = columns;
      row.appendChild(cell);
      tbody.appendChild(row);
    } else if (!isEmpty && row) {
      row.remove();
    }
  }

  setupFilter({
    search: "#stu-search",
    searchColumns: [0, 1],
    columns: 5,
    selects: [
      { selector: "#stu-class", column: 2, all: "all classes" },
      { selector: "#stu-status", column: 3, all: "all" },
    ],
  });
  setupFilter({
    search: "#staff-search",
    searchColumns: [0, 1],
    columns: 7,
    selects: [{ selector: "#staff-role", column: 2, all: "all roles" }],
  });
  setupFilter({
    search: "#fee-search",
    searchColumns: [0, 1],
    columns: 7,
    selects: [
      { selector: "#fee-class", column: 2, all: "all classes" },
      { selector: "#fee-status", column: 5, all: "all" },
    ],
  });

  /* ---------- 3. Fees: record a payment ---------- */
  const feeTable = $("#fee-search") ? $(".students-table tbody") : null;
  if (feeTable) {
    feeTable.addEventListener("click", (e) => {
      const link = e.target.closest(".row-action");
      if (!link) return;
      e.preventDefault();
      const row = link.closest("tr");
      const action = link.textContent.trim().toLowerCase();
      const badge = $(".badge", row);
      if (!badge) return;

      if (action === "record payment") {
        badge.className = "badge paid";
        badge.textContent = "Paid";
        link.textContent = "View receipt";
        showMessage("Payment recorded for " + row.cells[0].textContent.trim());
      } else if (action === "send reminder") {
        showMessage("Reminder sent to " + row.cells[0].textContent.trim());
      } else if (action === "view receipt") {
        showMessage("Receipt will open here once the backend is connected.");
      }
    });
  }

  /* ---------- 4. Attendance ---------- */
  const attDate = $("#att-date");
  if (attDate) {
    const attTable = $(".students-table tbody");
    const counters = $$(".summary-grid .summary-value"); // total, present, absent, leave
    const classSelect = $("#att-class");
    const sectionSelect = $("#att-section");
    const radios = () => $$('input[type="radio"]', attTable);

    if (!attDate.value) attDate.value = new Date().toISOString().slice(0, 10);

    const storageKey = () =>
      "academyos_attendance_" +
      attDate.value +
      "_" +
      classSelect.value +
      "_" +
      sectionSelect.value;

    function updateCounts() {
      const rows = $$("tr", attTable);
      const checked = (value) =>
        radios().filter((r) => r.checked && r.value === value).length;
      if (counters.length >= 4) {
        counters[0].textContent = rows.length;
        counters[1].textContent = checked("present");
        counters[2].textContent = checked("absent");
        counters[3].textContent = checked("leave");
      }
    }

    function restoreSaved() {
      let saved = {};
      try {
        saved = JSON.parse(localStorage.getItem(storageKey())) || {};
      } catch (e) {
        saved = {};
      }
      if (!Object.keys(saved).length) return false;
      radios().forEach((r) => {
        r.checked = saved[r.name] === r.value;
      });
      return true;
    }

    attTable.addEventListener("change", updateCounts);

    const footerButtons = $$(".panel-footer button");
    const markAll = footerButtons.find((b) =>
      /mark all present/i.test(b.textContent),
    );
    const save = footerButtons.find((b) =>
      /save attendance/i.test(b.textContent),
    );

    if (markAll) {
      markAll.addEventListener("click", () => {
        radios().forEach((r) => {
          r.checked = r.value === "present";
        });
        updateCounts();
      });
    }

    if (save) {
      save.addEventListener("click", () => {
        const data = {};
        radios().forEach((r) => {
          if (r.checked) data[r.name] = r.value;
        });
        const rows = $$("tr", attTable).length;
        if (Object.keys(data).length < rows) {
          showMessage("Mark every student before saving.", "error");
          return;
        }
        try {
          localStorage.setItem(storageKey(), JSON.stringify(data));
        } catch (e) {
          /* ignore */
        }
        showMessage("Attendance saved for " + attDate.value);
      });
    }

    // "Load students" button: reload any saved attendance for the chosen date, class and section.
    const toolbar = $(".toolbar");
    if (toolbar) {
      toolbar.addEventListener("submit", () => {
        radios().forEach((r) => {
          r.checked = false;
        });
        if (restoreSaved()) showMessage("Saved attendance loaded.");
        updateCounts();
      });
    }

    restoreSaved();
    updateCounts();
  }

  /* ---------- 5. Add student / Add staff ---------- */
  const phonePattern = /^03\d{2}-?\d{7}$/;

  function selectedText(select) {
    return select.options[select.selectedIndex].text;
  }

  const studentForm = $("#student-name") ? $(".student-form") : null;
  if (studentForm) {
    studentForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const phone = $("#guardian-phone");
      if (!phonePattern.test(phone.value.trim())) {
        showMessage(
          "Enter a valid phone number, for example 0300-1234567.",
          "error",
        );
        phone.focus();
        return;
      }
      const students = readStore("academyos_students");
      const admission = $("#admission-number").value.trim();
      if (
        students.some(
          (s) => s.admission.toLowerCase() === admission.toLowerCase(),
        )
      ) {
        showMessage("This admission number is already used.", "error");
        $("#admission-number").focus();
        return;
      }
      students.push({
        name: $("#student-name").value.trim(),
        admission: admission,
        className: selectedText($("#class")),
        section: $("#section") ? selectedText($("#section")) : "",
      });
      writeStore("academyos_students", students);
      try {
        localStorage.setItem("academyos_flash", "Student saved");
      } catch (err) {
        /* ignore */
      }
      window.location.href = "students.html";
    });
  }

  const staffForm = $("#staff-name") ? $(".student-form") : null;
  if (staffForm) {
    staffForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const phone = $("#staff-phone");
      if (!phonePattern.test(phone.value.trim())) {
        showMessage(
          "Enter a valid phone number, for example 0300-1234567.",
          "error",
        );
        phone.focus();
        return;
      }
      const staff = readStore("academyos_staff");
      const staffId = $("#staff-id").value.trim();
      if (
        staff.some((s) => s.staffId.toLowerCase() === staffId.toLowerCase())
      ) {
        showMessage("This staff ID is already used.", "error");
        $("#staff-id").focus();
        return;
      }
      const role = selectedText($("#staff-role-select"));
      staff.push({
        name: $("#staff-name").value.trim(),
        staffId: staffId,
        role: role,
        subject:
          role === "Teacher" ? selectedText($("#staff-subject")) : "\u2014",
        phone: phone.value.trim(),
        status: selectedText($("#staff-status")),
      });
      writeStore("academyos_staff", staff);
      try {
        localStorage.setItem("academyos_flash", "Staff member saved");
      } catch (err) {
        /* ignore */
      }
      window.location.href = "staff.html";
    });
  }

  /* ---------- 6. Show saved students and staff in their tables ---------- */
  if ($("#stu-search")) {
    const tbody = $(".students-table tbody");
    readStore("academyos_students").forEach((s) => {
      const row = document.createElement("tr");
      row.appendChild(td(s.name));
      row.appendChild(td(s.admission));
      row.appendChild(
        td(s.section ? s.className + " \u00b7 " + s.section : s.className),
      );
      row.appendChild(badgeCell("Active", "student-status"));
      row.appendChild(actionCell());
      tbody.appendChild(row);
    });
  }

  if ($("#staff-search")) {
    const tbody = $(".students-table tbody");
    const statusClass = {
      Active: "badge paid",
      "On leave": "badge pending",
      Inactive: "badge overdue",
    };
    readStore("academyos_staff").forEach((s) => {
      const row = document.createElement("tr");
      row.appendChild(td(s.name));
      row.appendChild(td(s.staffId));
      row.appendChild(td(s.role));
      row.appendChild(td(s.subject));
      row.appendChild(td(s.phone));
      row.appendChild(badgeCell(s.status, statusClass[s.status] || "badge"));
      const cell = document.createElement("td");
      const a = document.createElement("a");
      a.className = "row-action";
      a.href = "#";
      a.textContent = "Edit";
      cell.appendChild(a);
      row.appendChild(cell);
      tbody.appendChild(row);
    });
  }
  /* ---------- 7. Time-based greeting ---------- */
  /* ---------- 7. Time-based greeting ---------- */
  const greetTitle = $("[data-greeting-title]");
  if (greetTitle) {
    const now = new Date();
    const hour = now.getHours();
    let part = "Good night";
    if (hour >= 5 && hour < 12) part = "Good morning";
    else if (hour >= 12 && hour < 17) part = "Good afternoon";
    else if (hour >= 17 && hour < 21) part = "Good evening";

    const name = document.createElement("span");
    name.className = "greeting-name";
    name.textContent = greetTitle.dataset.name;
    greetTitle.textContent = part + ", ";
    greetTitle.appendChild(name);

    const greetDate = $("[data-greeting-date]");
    if (greetDate) {
      greetDate.textContent = now.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
  }
  /* ---------- 8. Dark theme toggle ---------- */
  /* ---------- 8. Dark theme toggle ---------- */
  const themeToggle = $(".theme-toggle");
  const svgStart =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  const themeIcons =
    svgStart +
    ' class="icon-moon"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>' +
    svgStart +
    ' class="icon-sun"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>';

  if (themeToggle) themeToggle.innerHTML = themeIcons;

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    if (themeToggle) {
      themeToggle.setAttribute(
        "aria-label",
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
      );
    }
  }

  let savedTheme = "light";
  try {
    savedTheme = localStorage.getItem("academyos_theme") || "light";
  } catch (e) {
    /* ignore */
  }
  applyTheme(savedTheme);

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const next =
        document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      applyTheme(next);
      try {
        localStorage.setItem("academyos_theme", next);
      } catch (e) {
        /* ignore */
      }
      if ($("canvas")) location.reload(); // redraw the dashboard charts in the new colors
    });
  }

  /* AcademyOS auth pages (login.html and signup.html).
   PROTOTYPE ONLY: accounts live in this browser's localStorage and passwords are
   neither stored nor checked. Real authentication will come from the backend. */
  (function () {
    "use strict";

    var USERS_KEY = "academyos_users";
    var phonePattern = /^03\d{2}-?\d{7}$/;
    var roleNames = { admin: "an Administrator", teacher: "a Teacher" };

    function readUsers() {
      try {
        return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
      } catch (e) {
        return [];
      }
    }
    function writeUsers(users) {
      try {
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
      } catch (e) {
        /* ignore */
      }
    }
    function setItem(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        /* ignore */
      }
    }

    function showError(form, message, field) {
      var box = form.querySelector(".form-error");
      if (box) {
        box.textContent = message;
        box.classList.add("show");
      }
      if (field) field.focus();
    }
    function clearError(form) {
      var box = form.querySelector(".form-error");
      if (box) box.classList.remove("show");
    }

    /* ---------- Login ---------- */
    var loginForm = document.getElementById("login-form");
    if (loginForm) {
      loginForm.addEventListener("input", function () {
        clearError(loginForm);
      });

      loginForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var role = document.getElementById("role").value;
        var emailField = document.getElementById("email");
        var email = emailField.value.trim().toLowerCase();

        var user = readUsers().filter(function (u) {
          return u.email === email;
        })[0];
        if (!user) {
          showError(
            loginForm,
            "No account found for this email. Please sign up first.",
            emailField,
          );
          return;
        }
        if (user.role !== role) {
          showError(
            loginForm,
            "This email is registered as " +
              roleNames[user.role] +
              ". Change the role and try again.",
            document.getElementById("role"),
          );
          return;
        }

        setItem("academyos_role", user.role);
        setItem(
          "academyos_current",
          JSON.stringify({
            name: user.name,
            email: user.email,
            role: user.role,
          }),
        );
        window.location.href =
          user.role === "teacher"
            ? "pages/teacher-dashboard.html"
            : "index.html";
      });
    }

    /* ---------- Sign up ---------- */
    var signupForm = document.getElementById("signup-form");
    if (signupForm) {
      signupForm.addEventListener("input", function () {
        clearError(signupForm);
      });

      signupForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var nameField = document.getElementById("signup-name");
        var emailField = document.getElementById("signup-email");
        var phoneField = document.getElementById("signup-phone");
        var passField = document.getElementById("signup-password");
        var confirmField = document.getElementById("signup-confirm");

        var name = nameField.value.trim();
        var email = emailField.value.trim().toLowerCase();
        var phone = phoneField.value.trim();

        if (name.length < 3) {
          showError(signupForm, "Please enter your full name.", nameField);
          return;
        }
        if (phone && !phonePattern.test(phone)) {
          showError(
            signupForm,
            "Enter a valid phone number, for example 0300-1234567.",
            phoneField,
          );
          return;
        }
        if (passField.value.length < 8) {
          showError(
            signupForm,
            "Password must be at least 8 characters.",
            passField,
          );
          return;
        }
        if (passField.value !== confirmField.value) {
          showError(
            signupForm,
            "The two passwords do not match.",
            confirmField,
          );
          return;
        }

        var users = readUsers();
        if (
          users.some(function (u) {
            return u.email === email;
          })
        ) {
          showError(
            signupForm,
            "An account with this email already exists. Please log in.",
            emailField,
          );
          return;
        }

        users.push({
          name: name,
          email: email,
          role: document.getElementById("signup-role").value,
          phone: phone,
        });
        writeUsers(users);
        setItem("academyos_flash", "Account created. Please log in.");
        window.location.href = "login.html";
      });
    }
  })();
  /* ===== User avatar menu (paste at the END of script.js, after the last block) ===== */
  (function () {
    "use strict";

    var menu = document.querySelector(".user-menu");
    if (!menu) return;

    var button = menu.querySelector(".avatar-button");
    var dropdown = menu.querySelector(".user-dropdown");
    var logout = menu.querySelector("[data-logout]");
    if (!button || !dropdown) return;

    /* Fill in the signed-in user (saved by the login form) */
    var current = null;
    try {
      current = JSON.parse(localStorage.getItem("academyos_current"));
    } catch (e) {
      current = null;
    }

    if (current && current.name) {
      var nameEl = menu.querySelector("[data-user-name]");
      var roleEl = menu.querySelector("[data-user-role]");
      var initialsEl = menu.querySelector("[data-user-initials]");

      if (nameEl) nameEl.textContent = current.name;
      if (roleEl)
        roleEl.textContent =
          current.role === "teacher" ? "Teacher" : "Administrator";
      if (initialsEl) {
        var parts = current.name.trim().split(/\s+/);
        var letters =
          parts[0].charAt(0) +
          (parts.length > 1 ? parts[parts.length - 1].charAt(0) : "");
        initialsEl.textContent = letters.toUpperCase();
      }
    }

    /* Open and close */
    function setOpen(open) {
      dropdown.hidden = !open;
      button.setAttribute("aria-expanded", open ? "true" : "false");
    }

    button.addEventListener("click", function (e) {
      e.stopPropagation();
      setOpen(dropdown.hidden);
    });

    document.addEventListener("click", function (e) {
      if (!menu.contains(e.target)) setOpen(false);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !dropdown.hidden) {
        setOpen(false);
        button.focus();
      }
    });

    /* Logout: clear the session, keep saved accounts and the theme, go to the login page */
    if (logout) {
      logout.addEventListener("click", function () {
        try {
          localStorage.removeItem("academyos_current");
          localStorage.removeItem("academyos_role");
        } catch (e) {
          /* ignore */
        }
        window.location.href = /\/pages\//i.test(window.location.pathname)
          ? "../login.html"
          : "login.html";
      });
    }
  })();
  /* ===== Settings page (paste at the END of script.js, after the last block) ===== */
  (function () {
    "use strict";

    if (!document.getElementById("profile-form")) return;

    var phonePattern = /^03\d{2}-?\d{7}$/;

    function read(key, fallback) {
      try {
        var v = JSON.parse(localStorage.getItem(key));
        return v === null ? fallback : v;
      } catch (e) {
        return fallback;
      }
    }
    function write(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        /* ignore */
      }
    }
    function toast(text, type) {
      var box = document.createElement("div");
      box.setAttribute("role", "status");
      box.textContent = text;
      box.style.cssText =
        "position:fixed;right:20px;bottom:20px;z-index:50;max-width:320px;padding:12px 16px;" +
        "border-radius:8px;color:#fff;font-size:14px;font-weight:700;box-shadow:0 4px 14px rgba(0,0,0,.15);" +
        "background:" +
        (type === "error" ? "#c0392b" : "#248453");
      document.body.appendChild(box);
      setTimeout(function () {
        box.remove();
      }, 3200);
    }
    function byId(id) {
      return document.getElementById(id);
    }

    var settings = read("academyos_settings", {});

    /* ---------- Profile ---------- */
    var current = read("academyos_current", null) || {
      name: "",
      email: "",
      role: "admin",
    };
    var users = read("academyos_users", []);
    var me =
      users.filter(function (u) {
        return u.email === current.email;
      })[0] || {};

    byId("settings-name").value = current.name || "";
    byId("settings-email").value = current.email || "";
    byId("settings-phone").value = me.phone || "";
    byId("settings-role").value =
      current.role === "teacher" ? "Teacher" : "Administrator";

    byId("profile-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var name = byId("settings-name").value.trim();
      var email = byId("settings-email").value.trim().toLowerCase();
      var phone = byId("settings-phone").value.trim();

      if (name.length < 3) {
        toast("Please enter your full name.", "error");
        return;
      }
      if (phone && !phonePattern.test(phone)) {
        toast("Enter a valid phone number, for example 0300-1234567.", "error");
        return;
      }

      var list = read("academyos_users", []);
      var taken = list.some(function (u) {
        return u.email === email && u.email !== current.email;
      });
      if (taken) {
        toast("Another account already uses this email.", "error");
        return;
      }

      var found = false;
      list.forEach(function (u) {
        if (u.email === current.email) {
          u.name = name;
          u.email = email;
          u.phone = phone;
          found = true;
        }
      });
      if (!found)
        list.push({
          name: name,
          email: email,
          role: current.role || "admin",
          phone: phone,
        });
      write("academyos_users", list);

      current = { name: name, email: email, role: current.role || "admin" };
      write("academyos_current", current);

      // Update the avatar menu straight away
      var parts = name.split(/\s+/);
      var initials = (
        parts[0].charAt(0) +
        (parts.length > 1 ? parts[parts.length - 1].charAt(0) : "")
      ).toUpperCase();
      var nameEl = document.querySelector("[data-user-name]");
      var initialsEl = document.querySelector("[data-user-initials]");
      if (nameEl) nameEl.textContent = name;
      if (initialsEl) initialsEl.textContent = initials;

      toast("Profile saved.");
    });

    /* ---------- Academy information ---------- */
    var academy = settings.academy || {};
    if (academy.name) byId("academy-name").value = academy.name;
    if (academy.phone) byId("academy-phone").value = academy.phone;
    if (academy.address) byId("academy-address").value = academy.address;
    if (academy.year) byId("academy-year").value = academy.year;

    byId("academy-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var phone = byId("academy-phone").value.trim();
      if (phone && !phonePattern.test(phone)) {
        toast(
          "Enter a valid contact number, for example 0300-1234567.",
          "error",
        );
        return;
      }
      settings = read("academyos_settings", {});
      settings.academy = {
        name: byId("academy-name").value.trim(),
        phone: phone,
        address: byId("academy-address").value.trim(),
        year: byId("academy-year").value,
      };
      write("academyos_settings", settings);
      toast("Academy details saved.");
    });

    /* ---------- Appearance (works together with the top bar toggle) ---------- */
    var themeRadios = Array.prototype.slice.call(
      document.querySelectorAll('input[name="theme"]'),
    );

    function syncRadios() {
      var theme =
        document.documentElement.dataset.theme === "dark" ? "dark" : "light";
      themeRadios.forEach(function (r) {
        r.checked = r.value === theme;
      });
    }
    syncRadios();

    themeRadios.forEach(function (r) {
      r.addEventListener("change", function () {
        document.documentElement.dataset.theme = r.value;
        try {
          localStorage.setItem("academyos_theme", r.value);
        } catch (e) {
          /* ignore */
        }
      });
    });

    var topToggle = document.querySelector(".theme-toggle");
    if (topToggle)
      topToggle.addEventListener("click", function () {
        setTimeout(syncRadios, 0);
      });

    /* ---------- Notifications ---------- */
    var notify = settings.notifications || null;
    var notifyForm = byId("notify-form");
    if (notify) {
      ["fees", "attendance", "weekly"].forEach(function (name) {
        if (notifyForm.elements[name])
          notifyForm.elements[name].checked = !!notify[name];
      });
    }
    notifyForm.addEventListener("submit", function (e) {
      e.preventDefault();
      settings = read("academyos_settings", {});
      settings.notifications = {
        fees: notifyForm.elements.fees.checked,
        attendance: notifyForm.elements.attendance.checked,
        weekly: notifyForm.elements.weekly.checked,
      };
      write("academyos_settings", settings);
      toast("Notification preferences saved.");
    });

    /* ---------- Change password (prototype: nothing is stored) ---------- */
    byId("password-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var oldPass = byId("current-password").value;
      var newPass = byId("new-password").value;
      var confirmPass = byId("confirm-password").value;

      if (newPass.length < 8) {
        toast("New password must be at least 8 characters.", "error");
        byId("new-password").focus();
        return;
      }
      if (newPass === oldPass) {
        toast("New password must be different from the current one.", "error");
        byId("new-password").focus();
        return;
      }
      if (newPass !== confirmPass) {
        toast("The two new passwords do not match.", "error");
        byId("confirm-password").focus();
        return;
      }

      byId("password-form").reset();
      toast("Password updated. (Demo only: passwords are not stored.)");
    });

    /* ---------- Reset demo data ---------- */
    byId("reset-demo").addEventListener("click", function () {
      if (
        !window.confirm(
          "Remove the sample students, staff and attendance saved in this browser?",
        )
      )
        return;
      try {
        var remove = [];
        for (var i = 0; i < localStorage.length; i++) {
          var key = localStorage.key(i);
          if (
            key === "academyos_students" ||
            key === "academyos_staff" ||
            key.indexOf("academyos_attendance_") === 0
          )
            remove.push(key);
        }
        remove.forEach(function (k) {
          localStorage.removeItem(k);
        });
      } catch (e) {
        /* ignore */
      }
      toast("Demo data removed.");
    });
  })();
  /* ===== Backup and restore (paste at the END of script.js, after the last block) ===== */
  (function () {
    "use strict";

    var downloadBtn = document.getElementById("backup-download");
    if (!downloadBtn) return;

    var restoreBtn = document.getElementById("backup-restore");
    var fileInput = document.getElementById("backup-file");
    var statusEl = document.getElementById("backup-status");

    // Session and housekeeping keys are never part of a backup.
    var SKIP = {
      academyos_current: 1,
      academyos_role: 1,
      academyos_flash: 1,
      academyos_last_backup: 1,
    };
    var MAX_SIZE = 2 * 1024 * 1024; // 2 MB

    function isBackupKey(key) {
      return key.indexOf("academyos_") === 0 && !SKIP[key];
    }

    function toast(text, type) {
      var box = document.createElement("div");
      box.setAttribute("role", "status");
      box.textContent = text;
      box.style.cssText =
        "position:fixed;right:20px;bottom:20px;z-index:50;max-width:320px;padding:12px 16px;" +
        "border-radius:8px;color:#fff;font-size:14px;font-weight:700;box-shadow:0 4px 14px rgba(0,0,0,.15);" +
        "background:" +
        (type === "error" ? "#c0392b" : "#248453");
      document.body.appendChild(box);
      setTimeout(function () {
        box.remove();
      }, 3600);
    }

    function updateStatus() {
      var last = null;
      try {
        last = parseInt(localStorage.getItem("academyos_last_backup"), 10);
      } catch (e) {
        last = null;
      }
      if (!last) {
        statusEl.textContent = "No backup downloaded yet.";
        return;
      }
      var when = new Date(last);
      var text =
        "Last backup: " +
        when.toLocaleString("en-GB", {
          dateStyle: "long",
          timeStyle: "short",
        }) +
        ".";
      if (Date.now() - last > 7 * 24 * 60 * 60 * 1000) {
        text += " It has been over a week, so consider downloading a new one.";
      }
      statusEl.textContent = text;
    }

    /* ---------- Download ---------- */
    downloadBtn.addEventListener("click", function () {
      var data = {};
      var count = 0;
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var key = localStorage.key(i);
          if (isBackupKey(key)) {
            data[key] = localStorage.getItem(key);
            count++;
          }
        }
      } catch (e) {
        /* ignore */
      }

      if (!count) {
        toast("There is no data to back up yet.", "error");
        return;
      }

      var payload = {
        app: "AcademyOS",
        version: 1,
        createdAt: new Date().toISOString(),
        data: data,
      };
      var blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      var url = URL.createObjectURL(blob);

      var link = document.createElement("a");
      link.href = url;
      link.download =
        "academyos-backup-" + new Date().toISOString().slice(0, 10) + ".json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 1000);

      try {
        localStorage.setItem("academyos_last_backup", String(Date.now()));
      } catch (e) {
        /* ignore */
      }
      updateStatus();
      toast("Backup downloaded.");
    });

    /* ---------- Restore ---------- */
    restoreBtn.addEventListener("click", function () {
      fileInput.click();
    });

    fileInput.addEventListener("change", function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;

      function finish() {
        fileInput.value = "";
      }

      if (file.size > MAX_SIZE) {
        toast("This file is too large to be an AcademyOS backup.", "error");
        finish();
        return;
      }

      var reader = new FileReader();
      reader.onerror = function () {
        toast("The file could not be read.", "error");
        finish();
      };
      reader.onload = function () {
        var payload;
        try {
          payload = JSON.parse(String(reader.result));
        } catch (e) {
          payload = null;
        }

        if (
          !payload ||
          payload.app !== "AcademyOS" ||
          !payload.data ||
          typeof payload.data !== "object"
        ) {
          toast("This is not a valid AcademyOS backup file.", "error");
          finish();
          return;
        }

        var keys = Object.keys(payload.data).filter(isBackupKey);
        var valid = keys.every(function (k) {
          return typeof payload.data[k] === "string";
        });
        if (!keys.length || !valid) {
          toast("This backup file is empty or damaged.", "error");
          finish();
          return;
        }

        var made = payload.createdAt
          ? new Date(payload.createdAt).toLocaleDateString("en-GB", {
              dateStyle: "long",
            })
          : "an unknown date";
        if (
          !window.confirm(
            "Restore the backup from " +
              made +
              "? The data currently saved in this browser will be replaced.",
          )
        ) {
          finish();
          return;
        }

        try {
          var existing = [];
          for (var i = 0; i < localStorage.length; i++) {
            if (isBackupKey(localStorage.key(i)))
              existing.push(localStorage.key(i));
          }
          existing.forEach(function (k) {
            localStorage.removeItem(k);
          });
          keys.forEach(function (k) {
            localStorage.setItem(k, payload.data[k]);
          });
        } catch (e) {
          toast(
            "Restore failed. Your browser storage may be full or blocked.",
            "error",
          );
          finish();
          return;
        }

        finish();
        toast("Backup restored. Reloading...");
        setTimeout(function () {
          window.location.reload();
        }, 1000);
      };
      reader.readAsText(file);
    });

    updateStatus();
  })();
  /* ===== AcademyOS updates (paste at the END of script.js, after the last block) =====
   1) Academics: Add class      2) Reports: view, CSV download, print/PDF
   3) Academy name from Settings shown next to the logo on every page            */
  (function () {
    "use strict";

    /* ---------- Helpers ---------- */
    const $ = (s, r) => (r || document).querySelector(s);
    const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
    const read = (k, f) => {
      try {
        const v = JSON.parse(localStorage.getItem(k));
        return v === null ? f : v;
      } catch (e) {
        return f;
      }
    };
    const write = (k, v) => {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (e) {
        /* ignore */
      }
    };

    function el(tag, className, text) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    }
    function toast(text, type) {
      const box = el("div", "", text);
      box.setAttribute("role", "status");
      box.style.cssText =
        "position:fixed;right:20px;bottom:20px;z-index:80;max-width:320px;padding:12px 16px;border-radius:8px;color:#fff;font-size:14px;font-weight:700;box-shadow:0 4px 14px rgba(0,0,0,.15);background:" +
        (type === "error" ? "#c0392b" : "#248453");
      document.body.appendChild(box);
      setTimeout(() => box.remove(), 3400);
    }

    /* ---------- 3. Academy name next to the logo ---------- */
    function applyBranding() {
      const name = (read("academyos_settings", {}).academy || {}).name;
      if (!name) return;
      $$(".brand-text, [data-academy-name]").forEach((node) => {
        (node.querySelector("a") || node).textContent = name;
      });
    }
    applyBranding();
    const academyForm = $("#academy-form");
    if (academyForm)
      academyForm.addEventListener("submit", () =>
        setTimeout(applyBranding, 0),
      );

    /* ---------- 1. Academics: Add class ---------- */
    const addClassBtn = $$(".add-button").find((b) =>
      /add class/i.test(b.textContent),
    );
    if (addClassBtn) {
      const tbody = $(".students-table:not(.timetable) tbody");
      const cards = {};
      $$(".summary-card").forEach((c) => {
        const h = $("h2", c),
          v = $(".summary-value", c);
        if (h && v)
          cards[h.textContent.trim().toLowerCase()] = {
            node: v,
            base: parseInt(v.textContent, 10) || 0,
          };
      });
      const baseGrades = [
        "Grade 6",
        "Grade 7",
        "Grade 8",
        "Grade 9",
        "Grade 10",
      ];
      const grades = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => "Grade " + n);

      function renderClasses() {
        $$("tr[data-saved]", tbody).forEach((r) => r.remove());
        const list = read("academyos_classes", []);
        list.forEach((c) => {
          const row = el("tr");
          row.dataset.saved = c.id;
          [
            c.className,
            c.section,
            c.teacher || "—",
            String(c.students),
          ].forEach((t) => row.appendChild(el("td", "", t)));
          const act = el("td");
          const del = el("a", "row-action", "Delete");
          del.href = "#";
          del.dataset.delete = c.id;
          act.appendChild(del);
          row.appendChild(act);
          tbody.appendChild(row);
        });
        const extraClasses = new Set(
          list
            .map((c) => c.className)
            .filter((n) => baseGrades.indexOf(n) === -1),
        );
        if (cards.sections)
          cards.sections.node.textContent = cards.sections.base + list.length;
        if (cards.classes)
          cards.classes.node.textContent =
            cards.classes.base + extraClasses.size;
      }

      tbody.addEventListener("click", (e) => {
        const del = e.target.closest("[data-delete]");
        if (!del) return;
        e.preventDefault();
        if (!window.confirm("Delete this class?")) return;
        write(
          "academyos_classes",
          read("academyos_classes", []).filter(
            (c) => c.id !== del.dataset.delete,
          ),
        );
        renderClasses();
        toast("Class deleted.");
      });

      function openClassModal() {
        const backdrop = el("div", "modal-backdrop");
        backdrop.innerHTML =
          '<form class="modal" role="dialog" aria-modal="true" aria-labelledby="class-modal-title">' +
          '<h2 id="class-modal-title">Add class</h2><p class="form-error" role="alert"></p>' +
          '<div class="form-grid">' +
          '<div class="form-field"><label for="m-class">Class</label><select id="m-class"><option value="">Select a class</option></select></div>' +
          '<div class="form-field"><label for="m-section">Section</label><select id="m-section"><option value="">Select a section</option><option>A</option><option>B</option><option>C</option><option>D</option></select></div>' +
          '<div class="form-field"><label for="m-teacher">Class teacher</label><input id="m-teacher" type="text" list="m-teachers" placeholder="e.g. Imran Khan" /><datalist id="m-teachers"></datalist></div>' +
          '<div class="form-field"><label for="m-students">Number of students</label><input id="m-students" type="number" min="0" max="200" value="0" /></div>' +
          '</div><div class="form-actions"><button class="cancel-button" type="button" data-close>Cancel</button><button class="add-button" type="submit">Save class</button></div></form>';

        const form = $("form", backdrop);
        grades.forEach((g) => {
          const o = el("option", "", g);
          o.value = g;
          $("#m-class", backdrop).appendChild(o);
        });
        read("academyos_staff", [])
          .filter((s) => s.role === "Teacher")
          .forEach((s) => {
            const o = el("option");
            o.value = s.name;
            $("#m-teachers", backdrop).appendChild(o);
          });
        document.body.appendChild(backdrop);
        $("#m-class", backdrop).focus();

        function close() {
          backdrop.remove();
          document.removeEventListener("keydown", onKey);
          addClassBtn.focus();
        }
        function onKey(e) {
          if (e.key === "Escape") close();
        }
        document.addEventListener("keydown", onKey);
        backdrop.addEventListener("click", (e) => {
          if (e.target === backdrop || e.target.closest("[data-close]"))
            close();
        });

        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const className = $("#m-class", backdrop).value;
          const section = $("#m-section", backdrop).value;
          const teacher = $("#m-teacher", backdrop).value.trim();
          const students = parseInt($("#m-students", backdrop).value, 10);
          const err = $(".form-error", backdrop);
          const fail = (msg) => {
            err.textContent = msg;
            err.classList.add("show");
          };

          if (!className) return fail("Please select a class.");
          if (!section) return fail("Please select a section.");
          if (isNaN(students) || students < 0 || students > 200)
            return fail("Number of students must be between 0 and 200.");
          const exists = $$("tr", tbody).some(
            (r) =>
              r.cells[0] &&
              r.cells[1] &&
              r.cells[0].textContent.trim() === className &&
              r.cells[1].textContent.trim() === section,
          );
          if (exists)
            return fail(className + " section " + section + " already exists.");

          const list = read("academyos_classes", []);
          list.push({
            id: "c" + Date.now(),
            className: className,
            section: section,
            teacher: teacher,
            students: students,
          });
          write("academyos_classes", list);
          close();
          renderClasses();
          toast("Class added.");
        });
      }

      addClassBtn.addEventListener("click", (e) => {
        e.preventDefault();
        openClassModal();
      });
      renderClasses();
    }

    /* ---------- 2. Reports ---------- */
    const grid = $(".report-grid");
    if (grid) {
      const SAMPLE_STUDENTS = [
        ["Ayesha Khan", "STU-001", "Grade 8", "A"],
        ["Bilal Ahmad", "STU-002", "Grade 8", "A"],
        ["Hamza Ali", "STU-003", "Grade 9", "B"],
        ["Sana Gul", "STU-004", "Grade 9", "A"],
        ["Usman Shah", "STU-005", "Grade 10", "A"],
      ];
      const FEES = [
        [
          "Ayesha Khan",
          "STU-001",
          "Grade 8",
          "Rs. 5,000",
          "10 Nov 2026",
          "Paid",
        ],
        [
          "Bilal Ahmad",
          "STU-002",
          "Grade 8",
          "Rs. 5,000",
          "10 Nov 2026",
          "Pending",
        ],
        [
          "Hamza Ali",
          "STU-003",
          "Grade 9",
          "Rs. 5,500",
          "10 Oct 2026",
          "Overdue",
        ],
      ];
      const MARKS = {
        "STU-001": [88, 92, 85],
        "STU-002": [72, 65, 70],
        "STU-003": [55, 60, 48],
        "STU-004": [91, 89, 94],
        "STU-005": [78, 81, 69],
      };
      const SAMPLE_STAFF = [
        ["Imran Khan", "STF-001", "Teacher", "Maths"],
        ["Sadia Noor", "STF-002", "Teacher", "English"],
        ["Farhan Ali", "STF-003", "Accountant", "—"],
      ];

      const classFilter = () => {
        const v = ($("#rep-class") || {}).value || "";
        return /^all/i.test(v) ? "" : v;
      };
      const byClass = (rows, idx) => {
        const f = classFilter();
        return f ? rows.filter((r) => r[idx] === f) : rows;
      };
      const allStudents = () =>
        SAMPLE_STUDENTS.concat(
          read("academyos_students", []).map((s) => [
            s.name,
            s.admission,
            s.className,
            s.section || "",
          ]),
        );
      const grade = (p) =>
        p >= 80 ? "A" : p >= 70 ? "B" : p >= 60 ? "C" : p >= 50 ? "D" : "F";

      const REPORTS = {
        attendance() {
          const from = ($("#rep-from") || {}).value,
            to = ($("#rep-to") || {}).value;
          let rows = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.indexOf("academyos_attendance_") !== 0) continue;
            const parts = key.replace("academyos_attendance_", "").split("_");
            const date = parts[0],
              cls = parts[1] || "",
              sec = parts[2] || "";
            if ((from && date < from) || (to && date > to)) continue;
            const vals = Object.values(read(key, {}));
            const p = vals.filter((v) => v === "present").length,
              a = vals.filter((v) => v === "absent").length,
              l = vals.filter((v) => v === "leave").length;
            const total = p + a + l;
            rows.push([
              date,
              cls,
              sec,
              p,
              a,
              l,
              total ? Math.round((p / total) * 100) + "%" : "—",
            ]);
          }
          rows.sort((x, y) => (x[0] < y[0] ? 1 : -1));
          let note = "";
          if (!rows.length) {
            rows = [
              ["2026-11-23", "Grade 8", "A", 28, 3, 1, "88%"],
              ["2026-11-23", "Grade 9", "A", 26, 2, 0, "93%"],
              ["2026-11-24", "Grade 8", "A", 30, 1, 1, "94%"],
            ];
            note =
              "Sample data shown. Save attendance on the Attendance page to see real records here.";
          }
          return {
            title: "Attendance report",
            cols: [
              "Date",
              "Class",
              "Section",
              "Present",
              "Absent",
              "Leave",
              "Attendance %",
            ],
            rows: byClass(rows, 1),
            note: note,
          };
        },
        fees() {
          const rows = byClass(FEES, 2);
          const paid = rows.filter((r) => r[5] === "Paid").length;
          return {
            title: "Fee collection report",
            cols: [
              "Student",
              "Admission ID",
              "Class",
              "Amount",
              "Due date",
              "Status",
            ],
            rows: rows,
            note: "Paid: " + paid + " of " + rows.length + " records.",
          };
        },
        students() {
          const rows = byClass(allStudents(), 2).map((r) => r.concat("Active"));
          return {
            title: "Student report",
            cols: ["Student", "Admission ID", "Class", "Section", "Status"],
            rows: rows,
            note: "Total students: " + rows.length + ".",
          };
        },
        results() {
          const rows = byClass(
            allStudents().filter((s) => MARKS[s[1]]),
            2,
          ).map((s) => {
            const m = MARKS[s[1]],
              total = m[0] + m[1] + m[2],
              pct = Math.round((total / 300) * 100);
            return [
              s[0],
              s[1],
              s[2],
              m[0],
              m[1],
              m[2],
              total,
              pct + "%",
              grade(pct),
            ];
          });
          return {
            title: "Result report",
            cols: [
              "Student",
              "Admission ID",
              "Class",
              "Maths",
              "English",
              "Physics",
              "Total",
              "Percentage",
              "Grade",
            ],
            rows: rows,
            note: "Sample marks. Real results will come from the backend.",
          };
        },
        staff() {
          const rows = SAMPLE_STAFF.concat(
            read("academyos_staff", []).map((s) => [
              s.name,
              s.staffId,
              s.role,
              s.subject,
            ]),
          );
          return {
            title: "Staff report",
            cols: ["Name", "Staff ID", "Role", "Subject"],
            rows: rows,
            note: "Total staff: " + rows.length + ".",
          };
        },
        defaulters() {
          const rows = byClass(
            FEES.filter((r) => r[5] === "Overdue"),
            2,
          );
          return {
            title: "Defaulters list",
            cols: [
              "Student",
              "Admission ID",
              "Class",
              "Amount",
              "Due date",
              "Status",
            ],
            rows: rows,
            note: "Students with overdue fees.",
          };
        },
      };

      function keyFor(card) {
        const t = ($("h2", card) || {}).textContent || "";
        return /attendance/i.test(t)
          ? "attendance"
          : /fee collection/i.test(t)
            ? "fees"
            : /defaulter/i.test(t)
              ? "defaulters"
              : /student/i.test(t)
                ? "students"
                : /result/i.test(t)
                  ? "results"
                  : /staff/i.test(t)
                    ? "staff"
                    : null;
      }

      const panel = el("section", "content-panel");
      panel.id = "report-output";
      panel.hidden = true;
      grid.after(panel);
      let currentKey = null,
        currentData = null;

      function csvDownload() {
        const esc = (v) => '"' + String(v).replace(/"/g, '""') + '"';
        const lines = [currentData.cols]
          .concat(currentData.rows)
          .map((r) => r.map(esc).join(","));
        const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
          type: "text/csv;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = el("a");
        a.href = url;
        a.download =
          "academyos-" +
          currentKey +
          "-report-" +
          new Date().toISOString().slice(0, 10) +
          ".csv";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast("Report downloaded.");
      }

      function render(key) {
        currentKey = key;
        currentData = REPORTS[key]();
        panel.innerHTML = "";
        panel.hidden = false;

        const actions = el("div", "report-actions");
        const csv = el("button", "add-button", "Download CSV");
        const print = el("button", "cancel-button", "Print / Save as PDF");
        const close = el("button", "cancel-button", "Close");
        [csv, print, close].forEach((b) => {
          b.type = "button";
          actions.appendChild(b);
        });
        csv.addEventListener("click", csvDownload);
        print.addEventListener("click", () => window.print());
        close.addEventListener("click", () => {
          panel.hidden = true;
          currentKey = null;
        });

        const meta =
          "Generated " +
          new Date().toLocaleDateString("en-GB", { dateStyle: "long" }) +
          " \u00b7 " +
          (classFilter() || "All classes");
        panel.appendChild(el("h2", "panel-title", currentData.title));
        panel.appendChild(el("p", "panel-note", meta));
        panel.appendChild(actions);

        if (!currentData.rows.length) {
          panel.appendChild(
            el("p", "panel-note", "No records match the selected filters."),
          );
        } else {
          const wrap = el("div", "table-scroll");
          const table = el("table", "students-table");
          const head = el("tr");
          currentData.cols.forEach((c) =>
            head.appendChild(el("th", "", c.toUpperCase())),
          );
          table.appendChild(el("thead")).appendChild(head);
          const body = el("tbody");
          currentData.rows.forEach((r) => {
            const tr = el("tr");
            r.forEach((v) => tr.appendChild(el("td", "", String(v))));
            body.appendChild(tr);
          });
          table.appendChild(body);
          wrap.appendChild(table);
          panel.appendChild(wrap);
        }
        if (currentData.note)
          panel.appendChild(el("p", "panel-note", currentData.note));
      }

      $$(".report-card").forEach((card) => {
        const key = keyFor(card);
        const link = $("a, button", card);
        if (!key || !link) return;
        link.addEventListener("click", (e) => {
          e.preventDefault();
          render(key);
          panel.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });

      ["#rep-from", "#rep-to", "#rep-class"].forEach((s) => {
        const f = $(s);
        if (f)
          f.addEventListener("change", () => {
            if (currentKey) render(currentKey);
          });
      });

      const exportBtn = $$(".toolbar .add-button").find((b) =>
        /export/i.test(b.textContent),
      );
      if (exportBtn)
        exportBtn.addEventListener("click", () => {
          if (currentKey) window.print();
          else toast("Open a report first, then export it.", "error");
        });
    }
  })();
})();
