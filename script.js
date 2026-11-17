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
})();
