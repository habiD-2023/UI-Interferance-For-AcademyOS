/* AcademyOS dashboard charts (Chart.js 4).
   Load Chart.js first, then this file. Each chart draws only if its canvas exists. */
(function () {
  "use strict";
  if (typeof Chart === "undefined") return;

  const colors = {
    primary: "#354fc5",
    primarySoft: "#edf0ff",
    green: "#248453",
    amber: "#b7791f",
    red: "#c0392b",
    grid: "#e8ecf2",
    text: "#778398",
  };

  Chart.defaults.font.family = "Arial, sans-serif";
  Chart.defaults.color = colors.text;
  Chart.defaults.maintainAspectRatio = false; // chart fills its .chart-box

  function draw(id, config) {
    const canvas = document.getElementById(id);
    if (canvas) new Chart(canvas, config);
  }

  const gridOptions = {
    grid: { color: colors.grid },
    border: { display: false },
  };

  // 1. Line chart: attendance this week
  draw("attendanceChart", {
    type: "line",
    data: {
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      datasets: [
        {
          label: "Attendance %",
          data: [92, 95, 90, 94, 88],
          borderColor: colors.primary,
          backgroundColor: colors.primarySoft,
          fill: true,
          tension: 0.35,
          pointRadius: 4,
        },
      ],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { min: 70, max: 100, ...gridOptions },
        x: { grid: { display: false } },
      },
    },
  });

  // 2. Doughnut chart: fee status
  draw("feeStatusChart", {
    type: "doughnut",
    data: {
      labels: ["Collected", "Pending", "Overdue"],
      datasets: [
        {
          data: [480000, 120000, 45000],
          backgroundColor: [colors.green, colors.amber, colors.red],
          borderWidth: 0,
        },
      ],
    },
    options: { cutout: "65%", plugins: { legend: { position: "bottom" } } },
  });

  // 3. Bar chart: students per class
  draw("classChart", {
    type: "bar",
    data: {
      labels: ["Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10"],
      datasets: [
        {
          label: "Students",
          data: [70, 82, 95, 88, 77],
          backgroundColor: colors.primary,
          borderRadius: 6,
        },
      ],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ...gridOptions },
        x: { grid: { display: false } },
      },
    },
  });

  // 4. Stacked bar chart: monthly fee collection
  draw("monthlyFeeChart", {
    type: "bar",
    data: {
      labels: ["Jul", "Aug", "Sep", "Oct", "Nov"],
      datasets: [
        {
          label: "Collected",
          data: [410, 450, 430, 470, 480],
          backgroundColor: colors.green,
        },
        {
          label: "Pending",
          data: [90, 70, 100, 85, 120],
          backgroundColor: colors.amber,
        },
      ],
    },
    options: {
      plugins: { legend: { position: "bottom" } },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: {
          stacked: true,
          ...gridOptions,
          title: { display: true, text: "Rs. (thousands)" },
        },
      },
    },
  });
})();
