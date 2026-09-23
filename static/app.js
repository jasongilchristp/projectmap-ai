/**
 * ProjectMapAI - Enhanced Frontend Logic
 * Dual-theme system (Dark/Light), Emerald & Amber aesthetics,
 * Live search/filtering, KPI analytics, timesheets, and instant UI feedback.
 */

// Global Application State
const appState = {
  entries: [],
  projects: [],
  employees: [],
  currentTheme: 'dark',
};

// ==========================================================================
// Theme Management (Light / Dark Mode)
// ==========================================================================
function initTheme() {
  const savedTheme = localStorage.getItem('pm_theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');

  setTheme(initialTheme, false);

  const themeToggleBtn = document.getElementById('themeToggleBtn');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const newTheme = appState.currentTheme === 'dark' ? 'light' : 'dark';
      setTheme(newTheme, true);
    });
  }

  // Listen to system OS preference changes if user hasn't explicitly set one
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('pm_theme')) {
      setTheme(e.matches ? 'dark' : 'light', false);
    }
  });
}

function setTheme(theme, save = true) {
  appState.currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  
  const themeLabel = document.getElementById('themeLabelText');
  if (themeLabel) {
    themeLabel.textContent = theme === 'dark' ? 'Dark' : 'Light';
  }

  if (save) {
    localStorage.setItem('pm_theme', theme);
    showToast(`Switched to ${theme === 'dark' ? 'Dark' : 'Light'} Mode`, 'info', 2000);
  }
}

// ==========================================================================
// Tab Navigation
// ==========================================================================
function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  const views = document.querySelectorAll('.view');

  function switchTab(viewId) {
    tabs.forEach(tab => {
      const isActive = tab.dataset.view === viewId;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    views.forEach(view => {
      const isActive = view.id === `view-${viewId}`;
      view.classList.toggle('active', isActive);
    });

    // If switching to summary and no summary loaded, auto-load first project
    if (viewId === 'summary') {
      const projectSelect = document.getElementById('projectSelect');
      if (projectSelect && projectSelect.value) {
        loadProjectSummary(projectSelect.value);
      }
    }
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.dataset.view);
    });
  });

  // Quick Log button in header
  const quickLogNavBtn = document.getElementById('quickLogNavBtn');
  if (quickLogNavBtn) {
    quickLogNavBtn.addEventListener('click', () => {
      switchTab('log');
      const employeeInput = document.getElementById('employeeInput');
      if (employeeInput) {
        employeeInput.focus();
      }
    });
  }
}

// ==========================================================================
// Toast Notification System
// ==========================================================================
function showToast(message, type = 'success', duration = 3500) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconSvg = '';
  if (type === 'success') {
    iconSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--emerald-500);flex-shrink:0"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  } else if (type === 'error') {
    iconSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--coral-500);flex-shrink:0"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
  } else {
    iconSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--amber-500);flex-shrink:0"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
  }

  toast.innerHTML = `
    ${iconSvg}
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideToastOut 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
    toast.addEventListener('animationend', () => toast.remove());
  }, duration);
}

// ==========================================================================
// Data Fetching & KPI Computing
// ==========================================================================
async function fetchEntries() {
  try {
    const res = await fetch('/api/entries');
    if (!res.ok) throw new Error('Failed to load entries');
    const entries = await res.json();
    appState.entries = entries;

    // Extract unique employees
    const employeeSet = new Set();
    entries.forEach(e => {
      if (e.employee_name) employeeSet.add(e.employee_name);
    });
    appState.employees = Array.from(employeeSet).sort();

    updateKPIs();
    renderEntriesTable();
    updateEmployeeOptions();
    updateEmployeeDatalist();
  } catch (err) {
    console.error('Error fetching entries:', err);
    showToast('Failed to load time entries from server', 'error');
  }
}

async function fetchProjects() {
  try {
    const res = await fetch('/api/projects');
    if (!res.ok) throw new Error('Failed to load projects');
    const projects = await res.json();
    appState.projects = projects;

    updateProjectDropdowns();
    renderQuickProjectChips();
    updateProjectDatalist();
  } catch (err) {
    console.error('Error fetching projects:', err);
  }
}

function updateKPIs() {
  const totalHours = appState.entries.reduce((sum, e) => sum + (parseFloat(e.hours) || 0), 0);
  const totalProjects = appState.projects.length;
  const totalEmployees = appState.employees.length;

  const totalHoursEl = document.getElementById('kpiTotalHours');
  if (totalHoursEl) {
    totalHoursEl.innerHTML = `${totalHours.toFixed(1)}<small>h</small>`;
  }

  const totalProjectsEl = document.getElementById('kpiTotalProjects');
  if (totalProjectsEl) {
    totalProjectsEl.textContent = totalProjects;
  }

  const totalEmployeesEl = document.getElementById('kpiTotalEmployees');
  if (totalEmployeesEl) {
    totalEmployeesEl.textContent = totalEmployees;
  }

  const latestActivityEl = document.getElementById('kpiLatestActivity');
  if (latestActivityEl) {
    if (appState.entries.length > 0) {
      const latest = appState.entries[0];
      latestActivityEl.textContent = `${latest.entry_date} • ${latest.employee_name}`;
    } else {
      latestActivityEl.textContent = 'None yet';
    }
  }

  const countBadge = document.getElementById('entriesCountBadge');
  if (countBadge) {
    countBadge.textContent = appState.entries.length;
  }
}

// ==========================================================================
// Entries Table & Live Search / Filter
// ==========================================================================
function getFilteredEntries() {
  const searchInput = document.getElementById('searchInput');
  const projectFilter = document.getElementById('projectFilterSelect');

  const query = (searchInput ? searchInput.value : '').toLowerCase().trim();
  const selectedProject = projectFilter ? projectFilter.value : '';

  return appState.entries.filter(entry => {
    const matchesProject = !selectedProject || entry.project === selectedProject;
    const matchesSearch = !query ||
      (entry.employee_name && entry.employee_name.toLowerCase().includes(query)) ||
      (entry.project && entry.project.toLowerCase().includes(query)) ||
      (entry.description && entry.description.toLowerCase().includes(query)) ||
      (entry.entry_date && entry.entry_date.includes(query));

    return matchesProject && matchesSearch;
  });
}

function renderEntriesTable() {
  const tbody = document.querySelector('#entriesTable tbody');
  const emptyState = document.getElementById('entriesEmptyState');
  const table = document.getElementById('entriesTable');
  if (!tbody) return;

  const filtered = getFilteredEntries();

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    if (table) table.style.display = 'none';
    if (emptyState) emptyState.style.display = 'flex';
    return;
  }

  if (table) table.style.display = 'table';
  if (emptyState) emptyState.style.display = 'none';

  tbody.innerHTML = filtered.map(e => {
    const initials = getInitials(e.employee_name);
    return `
      <tr>
        <td>
          <span class="date-text">${escapeHtml(e.entry_date)}</span>
        </td>
        <td>
          <div class="contributor-cell">
            <span class="avatar-badge">${escapeHtml(initials)}</span>
            <strong>${escapeHtml(e.employee_name)}</strong>
          </div>
        </td>
        <td>
          <span class="project-tag">${escapeHtml(e.project)}</span>
        </td>
        <td>
          <span class="hours-badge">${parseFloat(e.hours).toFixed(2)}h</span>
        </td>
        <td>
          <span class="desc-text">${e.description ? escapeHtml(e.description) : '<span style="color:var(--text-muted);font-style:italic">No notes provided</span>'}</span>
        </td>
      </tr>
    `;
  }).join('');
}

function initSearchAndFilter() {
  const searchInput = document.getElementById('searchInput');
  const clearBtn = document.getElementById('clearSearchBtn');
  const projectFilter = document.getElementById('projectFilterSelect');
  const exportBtn = document.getElementById('exportCsvBtn');

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      if (clearBtn) {
        clearBtn.style.display = searchInput.value ? 'block' : 'none';
      }
      renderEntriesTable();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.style.display = 'none';
      renderEntriesTable();
      searchInput.focus();
    });
  }

  if (projectFilter) {
    projectFilter.addEventListener('change', () => {
      renderEntriesTable();
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', exportToCsv);
  }
}

function exportToCsv() {
  const entries = getFilteredEntries();
  if (entries.length === 0) {
    showToast('No entries to export', 'info');
    return;
  }

  const headers = ['Date', 'Employee', 'Project', 'Hours', 'Description'];
  const rows = entries.map(e => [
    `"${e.entry_date}"`,
    `"${(e.employee_name || '').replace(/"/g, '""')}"`,
    `"${(e.project || '').replace(/"/g, '""')}"`,
    e.hours,
    `"${(e.description || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `ProjectMapAI_Timesheet_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast(`Exported ${entries.length} entries to CSV!`, 'success');
}

// ==========================================================================
// Project Dropdowns & Datalists
// ==========================================================================
function updateProjectDropdowns() {
  const filterSelect = document.getElementById('projectFilterSelect');
  const summarySelect = document.getElementById('projectSelect');

  if (filterSelect) {
    const currentVal = filterSelect.value;
    filterSelect.innerHTML = `<option value="">All Projects (${appState.projects.length})</option>` +
      appState.projects.map(p => `<option value="${escapeHtml(p)}" ${p === currentVal ? 'selected' : ''}>${escapeHtml(p)}</option>`).join('');
  }

  if (summarySelect) {
    const currentVal = summarySelect.value;
    summarySelect.innerHTML = appState.projects.map((p, idx) => 
      `<option value="${escapeHtml(p)}" ${(p === currentVal || (!currentVal && idx === 0)) ? 'selected' : ''}>${escapeHtml(p)}</option>`
    ).join('');
  }
}

function updateProjectDatalist() {
  const datalist = document.getElementById('projectDatalist');
  if (datalist) {
    datalist.innerHTML = appState.projects.map(p => `<option value="${escapeHtml(p)}">`).join('');
  }
}

function updateEmployeeDatalist() {
  const datalist = document.getElementById('employeeList');
  if (datalist) {
    datalist.innerHTML = appState.employees.map(e => `<option value="${escapeHtml(e)}">`).join('');
  }
}

function updateEmployeeOptions() {
  const timesheetSelect = document.getElementById('timesheetEmployeeSelect');
  if (timesheetSelect) {
    timesheetSelect.innerHTML = appState.employees.map(e => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join('');
  }
}

function renderQuickProjectChips() {
  const chipsList = document.getElementById('quickProjectChips');
  if (!chipsList) return;

  if (appState.projects.length === 0) {
    chipsList.innerHTML = '<span style="color:var(--text-muted);font-size:12px;">No projects yet</span>';
    return;
  }

  chipsList.innerHTML = appState.projects.map(p => `
    <button type="button" class="chip-btn" data-project="${escapeHtml(p)}">
      + ${escapeHtml(p)}
    </button>
  `).join('');

  chipsList.querySelectorAll('.chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const projectInput = document.getElementById('projectInput');
      if (projectInput) {
        projectInput.value = btn.dataset.project;
        projectInput.focus();
        showToast(`Selected project "${btn.dataset.project}"`, 'info', 1500);
      }
    });
  });
}

// ==========================================================================
// Project Summary / Analytics View
// ==========================================================================
async function loadProjectSummary(project) {
  if (!project) return;
  const resultContainer = document.getElementById('summaryResult');
  if (!resultContainer) return;

  resultContainer.innerHTML = `
    <div class="summary-placeholder">
      <div class="pulse-dot" style="width:12px;height:12px;"></div>
      <p>Crunching time data for ${escapeHtml(project)}...</p>
    </div>
  `;

  try {
    const res = await fetch(`/api/projects/${encodeURIComponent(project)}/summary`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Could not load summary');
    }
    const summary = await res.json();
    const total = parseFloat(summary.total_hours) || 0;
    const byEmployee = summary.by_employee || {};
    const entriesList = Object.entries(byEmployee).sort((a, b) => b[1] - a[1]);

    const breakdownHtml = entriesList.map(([name, hours]) => {
      const percent = total > 0 ? ((hours / total) * 100).toFixed(1) : 0;
      const initials = getInitials(name);
      return `
        <div class="breakdown-item">
          <div class="breakdown-meta">
            <span class="breakdown-name">
              <span class="avatar-badge" style="width:28px;height:28px;font-size:11px;">${escapeHtml(initials)}</span>
              ${escapeHtml(name)}
            </span>
            <span class="breakdown-hours-tag">${hours}h <small style="color:var(--text-muted);font-weight:500">(${percent}%)</small></span>
          </div>
          <div class="progress-track" title="${percent}% of project time">
            <div class="progress-fill" style="width: ${percent}%;"></div>
          </div>
        </div>
      `;
    }).join('');

    resultContainer.innerHTML = `
      <div class="summary-hero-card">
        <div>
          <span class="badge" style="margin-bottom:8px;">Project Analytics</span>
          <h3 class="summary-hero-title">${escapeHtml(summary.project)}</h3>
          <p class="summary-hero-desc">${entriesList.length} team member${entriesList.length !== 1 ? 's' : ''} logged hours</p>
        </div>
        <div class="summary-hero-stat">
          <div class="summary-hero-number">${total}h</div>
          <div class="summary-hero-label">Total Time Invested</div>
        </div>
      </div>

      <h4 class="breakdown-title">Contributor Breakdown &amp; Workload Share</h4>
      <div class="contributor-breakdown-list">
        ${breakdownHtml}
      </div>
    `;
  } catch (err) {
    resultContainer.innerHTML = `
      <div class="empty-state">
        <p style="color:var(--coral-500);font-weight:600;">${escapeHtml(err.message)}</p>
      </div>
    `;
  }
}

function initSummaryControls() {
  const loadBtn = document.getElementById('loadSummaryBtn');
  const projectSelect = document.getElementById('projectSelect');

  if (loadBtn) {
    loadBtn.addEventListener('click', () => {
      const project = projectSelect ? projectSelect.value : '';
      loadProjectSummary(project);
    });
  }

  if (projectSelect) {
    projectSelect.addEventListener('change', () => {
      loadProjectSummary(projectSelect.value);
    });
  }
}

// ==========================================================================
// Log Time Form Submission
// ==========================================================================
function initLogForm() {
  const form = document.getElementById('logForm');
  const dateInput = document.getElementById('dateInput');

  // Auto-fill today's date in YYYY-MM-DD
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const employee = document.getElementById('employeeInput').value.trim();
      const project = document.getElementById('projectInput').value.trim();
      const date = document.getElementById('dateInput').value;
      const hours = parseFloat(document.getElementById('hoursInput').value);
      const desc = document.getElementById('descInput').value.trim();

      if (!employee || !project || !date || isNaN(hours) || hours <= 0) {
        showToast('Please fill out all required fields with valid hours', 'error');
        return;
      }

      const submitBtn = document.getElementById('submitLogBtn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.querySelector('span').textContent = 'Saving...';
      }

      try {
        const res = await fetch('/api/entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_name: employee,
            project: project,
            entry_date: date,
            hours: hours,
            description: desc,
          }),
        });

        if (!res.ok) {
          throw new Error('Failed to save time entry');
        }

        showToast(`Successfully logged ${hours}h for ${employee}!`, 'success');
        form.reset();

        // Reset default date to today
        if (dateInput) {
          dateInput.value = new Date().toISOString().split('T')[0];
        }

        // Refresh state
        await fetchEntries();
        await fetchProjects();

        // If user logged for the currently selected summary project, refresh summary too
        const summarySelect = document.getElementById('projectSelect');
        if (summarySelect && summarySelect.value === project) {
          loadProjectSummary(project);
        }
      } catch (err) {
        console.error('Error logging time:', err);
        showToast(err.message || 'Error saving time entry', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.querySelector('span').textContent = 'Save Time Entry';
        }
      }
    });
  }
}

// ==========================================================================
// Timesheet Inspector View
// ==========================================================================
function initTimesheetView() {
  const loadBtn = document.getElementById('loadTimesheetBtn');
  if (!loadBtn) return;

  loadBtn.addEventListener('click', async () => {
    const employeeSelect = document.getElementById('timesheetEmployeeSelect');
    const startDateInput = document.getElementById('timesheetStartDate');
    const endDateInput = document.getElementById('timesheetEndDate');
    const resultArea = document.getElementById('timesheetResultArea');

    const employee = employeeSelect ? employeeSelect.value : '';
    const startDate = startDateInput ? startDateInput.value : '';
    const endDate = endDateInput ? endDateInput.value : '';

    if (!employee) {
      showToast('Select an employee to inspect timesheet', 'info');
      return;
    }

    resultArea.innerHTML = `
      <div class="summary-placeholder">
        <div class="pulse-dot" style="width:12px;height:12px;"></div>
        <p>Loading timesheet for ${escapeHtml(employee)}...</p>
      </div>
    `;

    try {
      let url = `/api/timesheet/${encodeURIComponent(employee)}`;
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      const queryStr = params.toString();
      if (queryStr) url += `?${queryStr}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('Could not fetch timesheet');
      const records = await res.json();

      if (records.length === 0) {
        resultArea.innerHTML = `
          <div class="empty-state">
            <p>No logged entries found for ${escapeHtml(employee)} in the specified date range.</p>
          </div>
        `;
        return;
      }

      const totalHours = records.reduce((s, r) => s + (parseFloat(r.hours) || 0), 0);

      const tableRows = records.map(r => `
        <tr>
          <td><span class="date-text">${escapeHtml(r.entry_date)}</span></td>
          <td><span class="project-tag">${escapeHtml(r.project)}</span></td>
          <td><span class="hours-badge">${parseFloat(r.hours).toFixed(2)}h</span></td>
          <td><span class="desc-text">${r.description ? escapeHtml(r.description) : '-'}</span></td>
        </tr>
      `).join('');

      resultArea.innerHTML = `
        <div class="summary-hero-card">
          <div>
            <span class="badge" style="margin-bottom:8px;">Timesheet Report</span>
            <h3 class="summary-hero-title">${escapeHtml(employee)}</h3>
            <p class="summary-hero-desc">
              ${startDate || endDate ? `${startDate || 'Start'} to ${endDate || 'Present'}` : 'All time records'}
            </p>
          </div>
          <div class="summary-hero-stat">
            <div class="summary-hero-number">${totalHours.toFixed(1)}h</div>
            <div class="summary-hero-label">Logged Period Total</div>
          </div>
        </div>

        <div class="table-container">
          <table class="entries-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Project</th>
                <th>Hours</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      resultArea.innerHTML = `
        <div class="empty-state">
          <p style="color:var(--coral-500);">${escapeHtml(err.message)}</p>
        </div>
      `;
    }
  });
}

// ==========================================================================
// Helpers
// ==========================================================================
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ==========================================================================
// Initialization
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initTabs();
  initSearchAndFilter();
  initSummaryControls();
  initLogForm();
  initTimesheetView();

  // Load initial data
  fetchEntries();
  fetchProjects();
});
