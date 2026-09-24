/**
 * ProjectMapAI - Enhanced Frontend Logic
 * Dual-theme system (Dark/Light), Emerald & Amber aesthetics,
 * Live search/filtering, KPI analytics, timesheets, and interactive AI / MCP Lab.
 */

// Global Application State
const appState = {
  entries: [],
  projects: [],
  employees: [],
  currentTheme: 'dark',
  mcpTools: [],
  slowToolAbortController: null,
};

// Global Tab Switcher reference
let switchTabGlobal = null;

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
    themeLabel.textContent = theme === 'dark' ? 'POLARITY: DARK' : 'POLARITY: LIGHT';
  }

  if (save) {
    localStorage.setItem('pm_theme', theme);
    showToast(`POLARITY: ${theme.toUpperCase()}`, 'info', 2000);
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
      if (isActive) {
        const titleEl = view.querySelector('.section-title');
        if (titleEl && !titleEl.dataset.scrambling) {
          titleEl.dataset.scrambling = '1';
          const originalText = titleEl.textContent;
          scrambleText(titleEl, originalText, 250);
          setTimeout(() => { delete titleEl.dataset.scrambling; }, 300);
        }
      }
    });

    // Auto-load project analytics if switching to summary
    if (viewId === 'summary') {
      const projectSelect = document.getElementById('projectSelect');
      if (projectSelect && projectSelect.value) {
        loadProjectSummary(projectSelect.value);
      }
    }

    // Auto-load tools registry if switching to MCP lab
    if (viewId === 'mcp') {
      fetchMcpTools();
    }
  }

  switchTabGlobal = switchTab;

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
    updateMcpLabDropdowns();
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
    updateMcpLabDropdowns();
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
    totalHoursEl.innerHTML = `${totalHours.toFixed(1)}<span class="kpi-unit">HRS</span>`;
  }

  const totalProjectsEl = document.getElementById('kpiTotalProjects');
  if (totalProjectsEl) {
    totalProjectsEl.innerHTML = `${totalProjects}<span class="kpi-unit">NODES</span>`;
  }

  const totalEmployeesEl = document.getElementById('kpiTotalEmployees');
  if (totalEmployeesEl) {
    totalEmployeesEl.innerHTML = `${totalEmployees}<span class="kpi-unit">UNITS</span>`;
  }

  const latestActivityEl = document.getElementById('kpiLatestActivity');
  if (latestActivityEl) {
    if (appState.entries.length > 0) {
      const latest = appState.entries[0];
      latestActivityEl.textContent = `${latest.entry_date} // ${latest.employee_name}`;
    } else {
      latestActivityEl.textContent = 'NO_DATA';
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
      <tr data-entry-id="${e.id}">
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
          <span class="hours-badge">${parseFloat(e.hours).toFixed(2)} HRS</span>
        </td>
        <td>
          <span class="date-text">${escapeHtml(e.entry_date)}</span>
        </td>
        <td>
          <span class="desc-text">${e.description ? escapeHtml(e.description) : '<span style="color:var(--text-muted)">// ZERO_LOG_REMARKS</span>'}</span>
        </td>
        <td style="text-align: center;">
          <div class="table-actions">
            <button type="button" class="action-btn action-edit" onclick="openEditModal(${e.id})" title="Edit Entry #${e.id}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              <span>EDIT</span>
            </button>
            <button type="button" class="action-btn action-delete" onclick="openDeleteModal(${e.id})" title="Delete Entry #${e.id}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              <span>DEL</span>
            </button>
          </div>
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

function updateMcpLabDropdowns() {
  const aiEmployeeSelect = document.getElementById('aiSummaryEmployeeSelect');
  if (aiEmployeeSelect) {
    const current = aiEmployeeSelect.value;
    aiEmployeeSelect.innerHTML = appState.employees.map(e => `<option value="${escapeHtml(e)}" ${e === current ? 'selected' : ''}>${escapeHtml(e)}</option>`).join('');
  }

  const confirmEmployeeSelect = document.getElementById('confirmEmployeeSelect');
  if (confirmEmployeeSelect) {
    const current = confirmEmployeeSelect.value;
    confirmEmployeeSelect.innerHTML = appState.employees.map(e => `<option value="${escapeHtml(e)}" ${e === current ? 'selected' : ''}>${escapeHtml(e)}</option>`).join('');
  }

  const confirmProjectSelect = document.getElementById('confirmProjectSelect');
  if (confirmProjectSelect) {
    const current = confirmProjectSelect.value;
    confirmProjectSelect.innerHTML = appState.projects.map(p => `<option value="${escapeHtml(p)}" ${p === current ? 'selected' : ''}>${escapeHtml(p)}</option>`).join('');
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
// High-Hours Confirmation Modal (Emulating MCP ctx.elicit)
// ==========================================================================
function promptHighHoursConfirmation(entryData) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirmationModal');
    const promptText = document.getElementById('modalPromptText');
    const preview = document.getElementById('modalEntryPreview');
    const confirmBtn = document.getElementById('modalConfirmBtn');
    const cancelBtn = document.getElementById('modalCancelBtn');

    if (!modal) {
      resolve(confirm(`${entryData.hours} hours in one day is unusually high -- log it anyway?`));
      return;
    }

    if (promptText) {
      promptText.textContent = `${entryData.hours} hours in one day is unusually high -- log it anyway?`;
    }

    if (preview) {
      preview.innerHTML = `
        <div class="modal-preview-row">
          <span>Contributor:</span>
          <strong>${escapeHtml(entryData.employee_name)}</strong>
        </div>
        <div class="modal-preview-row">
          <span>Project:</span>
          <strong>${escapeHtml(entryData.project)}</strong>
        </div>
        <div class="modal-preview-row">
          <span>Date:</span>
          <strong>${escapeHtml(entryData.entry_date)}</strong>
        </div>
        <div class="modal-preview-row">
          <span>// HOURS:</span>
          <strong style="color:var(--accent-red);font-size:14px;font-family:var(--font-dot);">${entryData.hours}H [HIGH_HOURS]</strong>
        </div>
        ${entryData.description ? `
          <div class="modal-preview-row">
            <span>// NOTES:</span>
            <span>${escapeHtml(entryData.description)}</span>
          </div>
        ` : ''}
      `;
    }

    function cleanup() {
      modal.style.display = 'none';
      confirmBtn.removeEventListener('click', onConfirm);
      cancelBtn.removeEventListener('click', onCancel);
    }

    function onConfirm() {
      cleanup();
      resolve(true);
    }

    function onCancel() {
      cleanup();
      resolve(false);
    }

    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);

    modal.style.display = 'flex';
  });
}

// ==========================================================================
// Log Time Form Submission (With Elicitation Guard)
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
        showToast('Please fill out all required fields with valid positive hours', 'error');
        return;
      }

      // If hours > 10, trigger confirmation modal (mirroring MCP ctx.elicit)
      let confirmed = null;
      if (hours > 10) {
        const accepted = await promptHighHoursConfirmation({
          employee_name: employee,
          project: project,
          entry_date: date,
          hours: hours,
          description: desc,
        });

        if (!accepted) {
          showToast('Time entry discarded by user', 'info');
          return;
        }
        confirmed = true;
      }

      const submitBtn = document.getElementById('submitLogBtn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.querySelector('span').textContent = 'Saving...';
      }

      try {
        const res = await fetch('/api/entries/with-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_name: employee,
            project: project,
            entry_date: date,
            hours: hours,
            description: desc,
            confirmed: confirmed,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.detail || 'Failed to save time entry');
        }

        if (data.status === 'confirmation_required') {
          // If server asks for confirmation
          const accepted = await promptHighHoursConfirmation({
            employee_name: employee,
            project: project,
            entry_date: date,
            hours: hours,
            description: desc,
          });

          if (!accepted) {
            showToast('Time entry cancelled', 'info');
            return;
          }

          // Submit with confirmed = true
          await fetch('/api/entries/with-confirmation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employee_name: employee,
              project: project,
              entry_date: date,
              hours: hours,
              description: desc,
              confirmed: true,
            }),
          });
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
            <div style="margin-top: 10px;">
              <button id="btnTimesheetToSummary" class="btn btn-secondary btn-sm" type="button" title="Generate AI Weekly Summary in MCP Lab">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
                <span>Generate AI Week Summary</span>
              </button>
            </div>
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

      // Wire up quick AI summary launch button
      const aiBtn = document.getElementById('btnTimesheetToSummary');
      if (aiBtn) {
        aiBtn.addEventListener('click', () => {
          if (switchTabGlobal) switchTabGlobal('mcp');
          switchMcpSubpanel('summarizer');
          const aiEmpSelect = document.getElementById('aiSummaryEmployeeSelect');
          const aiWeekInput = document.getElementById('aiSummaryWeekInput');
          if (aiEmpSelect) aiEmpSelect.value = employee;
          if (aiWeekInput) {
            aiWeekInput.value = startDate || (records[0] ? records[0].entry_date : new Date().toISOString().split('T')[0]);
          }
          triggerAiSummary();
        });
      }

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
// AI & MCP Lab View (Studio Workspace)
// ==========================================================================
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().split('T')[0];
}

function switchMcpSubpanel(subtabId) {
  const pills = document.querySelectorAll('.studio-pill');
  const subpanels = document.querySelectorAll('.studio-subpanel');

  pills.forEach(pill => {
    pill.classList.toggle('active', pill.dataset.subtab === subtabId);
  });

  subpanels.forEach(panel => {
    panel.classList.toggle('active', panel.id === `subpanel-${subtabId}`);
  });

  if (subtabId === 'registry') {
    fetchMcpTools();
  }
}

async function triggerAiSummary() {
  const employeeSelect = document.getElementById('aiSummaryEmployeeSelect');
  const weekInput = document.getElementById('aiSummaryWeekInput');
  const emptyCanvas = document.getElementById('aiSummaryCanvasEmpty');
  const outputArea = document.getElementById('aiSummaryOutputArea');
  const outputText = document.getElementById('aiSummaryText');
  const statsPill = document.getElementById('aiSummaryStats');
  const runBtn = document.getElementById('btnRunSummary');

  const employee = employeeSelect ? employeeSelect.value : '';
  const weekStart = weekInput ? weekInput.value : '';

  if (!employee || !weekStart) {
    showToast('Please select both an employee and week start date', 'info');
    return;
  }

  if (runBtn) {
    runBtn.disabled = true;
    runBtn.querySelector('span').textContent = 'Consulting Groq LLM...';
  }

  if (emptyCanvas) emptyCanvas.style.display = 'none';
  if (outputArea) outputArea.style.display = 'block';
  if (statsPill) statsPill.textContent = 'Generating with Groq...';

  if (outputText) {
    outputText.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;color:var(--text-muted);">
        <div class="pulse-dot" style="width:10px;height:10px;"></div>
        <span>Generating natural-language summary for ${escapeHtml(employee)} (${escapeHtml(weekStart)})...</span>
      </div>
    `;
  }

  try {
    const res = await fetch('/api/summarize-week', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_name: employee,
        week_start: weekStart,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.detail || data.summary || 'Failed to generate summary');
    }

    if (outputText) {
      outputText.textContent = data.summary;
    }

    if (statsPill) {
      statsPill.textContent = `${data.entries_count} entries • ${data.total_hours}h total`;
    }

    showToast('AI weekly summary generated successfully!', 'success');
  } catch (err) {
    console.error('Error generating summary:', err);
    if (outputText) {
      outputText.innerHTML = `<span style="color:var(--coral-500);font-weight:600;">Error: ${escapeHtml(err.message)}</span>`;
    }
    if (statsPill) statsPill.textContent = 'Generation failed';
    showToast(err.message || 'AI summary failed', 'error');
  } finally {
    if (runBtn) {
      runBtn.disabled = false;
      runBtn.querySelector('span').textContent = 'Generate AI Summary';
    }
  }
}

function updatePipelineSteps(activeStep, status = 'in_progress') {
  for (let s = 1; s <= 4; s++) {
    const el = document.getElementById(`pipeStep${s}`);
    if (!el) continue;
    el.classList.remove('step-done', 'step-active', 'step-cancelled');
    if (s < activeStep) {
      el.classList.add('step-done');
    } else if (s === activeStep) {
      if (status === 'done') el.classList.add('step-done');
      else if (status === 'cancelled') el.classList.add('step-cancelled');
      else el.classList.add('step-active');
    }
  }
}

function initMcpLab() {
  // Studio Subpanel Pill switcher
  document.querySelectorAll('.studio-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      switchMcpSubpanel(pill.dataset.subtab);
    });
  });

  // 1. AI Summary Form
  const summaryForm = document.getElementById('aiSummaryForm');
  const btnFillCurrentWeek = document.getElementById('btnFillCurrentWeek');
  const btnPresetDemoWeek = document.getElementById('btnPresetDemoWeek');
  const aiSummaryWeekInput = document.getElementById('aiSummaryWeekInput');
  const btnCopySummary = document.getElementById('btnCopySummary');

  // Default week to current Monday
  if (aiSummaryWeekInput && !aiSummaryWeekInput.value) {
    aiSummaryWeekInput.value = getMonday(new Date());
  }

  if (btnFillCurrentWeek) {
    btnFillCurrentWeek.addEventListener('click', () => {
      if (aiSummaryWeekInput) {
        aiSummaryWeekInput.value = getMonday(new Date());
        showToast('Set date to current week Monday', 'info', 1500);
      }
    });
  }

  if (btnPresetDemoWeek) {
    btnPresetDemoWeek.addEventListener('click', () => {
      if (aiSummaryWeekInput) {
        aiSummaryWeekInput.value = btnPresetDemoWeek.dataset.date || '2026-09-08';
        showToast('Set date to seed data week (2026-09-08)', 'info', 1500);
      }
    });
  }

  // Suggestion chips inside empty state canvas
  document.querySelectorAll('.btn-suggestion').forEach(btn => {
    btn.addEventListener('click', () => {
      const empSelect = document.getElementById('aiSummaryEmployeeSelect');
      const weekInp = document.getElementById('aiSummaryWeekInput');
      if (empSelect && btn.dataset.employee) {
        empSelect.value = btn.dataset.employee;
      }
      if (weekInp && btn.dataset.date) {
        weekInp.value = btn.dataset.date;
      }
      triggerAiSummary();
    });
  });

  if (summaryForm) {
    summaryForm.addEventListener('submit', (e) => {
      e.preventDefault();
      triggerAiSummary();
    });
  }

  if (btnCopySummary) {
    btnCopySummary.addEventListener('click', async () => {
      const outputText = document.getElementById('aiSummaryText');
      if (outputText && outputText.textContent) {
        try {
          await navigator.clipboard.writeText(outputText.textContent);
          showToast('Summary copied to clipboard!', 'success', 2000);
        } catch {
          showToast('Could not copy text to clipboard', 'error');
        }
      }
    });
  }

  // 2. High-Hours Confirmation Demo Form & Elicitation Guard
  const confirmTestForm = document.getElementById('confirmationTestForm');
  const confirmDateInput = document.getElementById('confirmDateInput');
  const confirmHoursSlider = document.getElementById('confirmHoursSlider');
  const confirmHoursInput = document.getElementById('confirmHoursInput');
  const hoursRiskBadge = document.getElementById('hoursRiskBadge');
  const confirmationResultArea = document.getElementById('confirmationResultArea');
  const confirmationResultContent = document.getElementById('confirmationResultContent');
  const guardPlaceholder = document.getElementById('guardPlaceholder');

  function syncHours(val) {
    const hours = parseFloat(val) || 0;
    if (hoursRiskBadge) {
      if (hours > 10) {
        hoursRiskBadge.className = 'risk-badge risk-high';
        hoursRiskBadge.textContent = `High Hours (${hours}h > 10h)`;
      } else {
        hoursRiskBadge.className = 'risk-badge risk-safe';
        hoursRiskBadge.textContent = `Safe (${hours}h \u2264 10h)`;
      }
    }
  }

  if (confirmHoursSlider && confirmHoursInput) {
    confirmHoursSlider.addEventListener('input', () => {
      confirmHoursInput.value = confirmHoursSlider.value;
      syncHours(confirmHoursSlider.value);
    });

    confirmHoursInput.addEventListener('input', () => {
      const val = parseFloat(confirmHoursInput.value);
      if (!isNaN(val) && val >= 1 && val <= 20) {
        confirmHoursSlider.value = val;
      }
      syncHours(confirmHoursInput.value);
    });

    syncHours(confirmHoursInput.value);
  }

  if (confirmDateInput && !confirmDateInput.value) {
    confirmDateInput.value = new Date().toISOString().split('T')[0];
  }

  if (confirmTestForm) {
    confirmTestForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const employee = document.getElementById('confirmEmployeeSelect').value;
      const project = document.getElementById('confirmProjectSelect').value;
      const date = document.getElementById('confirmDateInput').value;
      const hours = parseFloat(document.getElementById('confirmHoursInput').value);
      const desc = document.getElementById('confirmDescInput').value.trim();

      if (!employee || !project || !date || isNaN(hours) || hours <= 0) {
        showToast('Please fill out all fields with valid hours', 'error');
        return;
      }

      if (guardPlaceholder) guardPlaceholder.style.display = 'none';
      if (confirmationResultArea) confirmationResultArea.style.display = 'block';

      // Step 1: Agent call initiated, Step 2: Threshold check
      updatePipelineSteps(2, 'in_progress');

      confirmationResultContent.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="pulse-dot" style="width:8px;height:8px;"></div>
          <span>Testing FastMCP elicitation rule for ${hours} hours...</span>
        </div>
      `;

      try {
        const res = await fetch('/api/entries/with-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_name: employee,
            project: project,
            entry_date: date,
            hours: hours,
            description: desc,
            confirmed: null,
          }),
        });

        const data = await res.json();

        if (data.status === 'confirmation_required') {
          // Step 3: FastMCP ctx.elicit paused execution
          updatePipelineSteps(3, 'in_progress');

          confirmationResultContent.innerHTML = `
            <div style="color:var(--amber-400);font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
              <span>⚠️</span>
              <span>FastMCP Elicitation Interrupted: Server paused tool execution!</span>
            </div>
            <p style="margin:0 0 10px;color:var(--text-main);line-height:1.4;">${escapeHtml(data.message)}</p>
            <div style="font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:6px;">
              <div class="pulse-dot" style="width:7px;height:7px;"></div>
              <span>Awaiting human approval in dialog...</span>
            </div>
          `;

          // Trigger dialog
          const accepted = await promptHighHoursConfirmation({
            employee_name: employee,
            project: project,
            entry_date: date,
            hours: hours,
            description: desc,
          });

          // Send confirmation outcome
          const secondRes = await fetch('/api/entries/with-confirmation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employee_name: employee,
              project: project,
              entry_date: date,
              hours: hours,
              description: desc,
              confirmed: accepted,
            }),
          });

          const secondData = await secondRes.json();

          if (accepted && secondData.status === 'logged') {
            updatePipelineSteps(4, 'done');
            confirmationResultContent.innerHTML = `
              <div style="color:var(--emerald-400);font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
                <span>✓</span>
                <span>Human Approved &amp; Logged: Entry #${secondData.entry.id} saved to ProjectMapAI Cloud Database!</span>
              </div>
              <p style="margin:0;color:var(--text-secondary);font-size:12px;">
                ${escapeHtml(employee)} • ${escapeHtml(project)} • <strong>${hours}h</strong>
              </p>
            `;

            showToast(`Confirmed & logged ${hours}h!`, 'success');
            await fetchEntries();
            await fetchProjects();
          } else {
            updatePipelineSteps(4, 'cancelled');
            confirmationResultContent.innerHTML = `
              <div style="color:var(--coral-400);font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
                <span>✕</span>
                <span>User Cancelled: Tool call aborted (reason: ${escapeHtml(secondData.reason || 'declined')}).</span>
              </div>
              <p style="margin:0;color:var(--text-muted);font-size:12px;">No database mutation occurred.</p>
            `;
            showToast('Tool call cancelled', 'info');
          }

        } else if (data.status === 'logged') {
          updatePipelineSteps(4, 'done');
          confirmationResultContent.innerHTML = `
            <div style="color:var(--emerald-400);font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
              <span>✓</span>
              <span>Logged directly: Entry #${data.entry.id} (${hours}h &le; 10h threshold).</span>
            </div>
            <p style="margin:0;color:var(--text-secondary);font-size:12px;">No elicitation pause required for normal hours.</p>
          `;
          showToast(`Logged ${hours}h`, 'success');
          await fetchEntries();
          await fetchProjects();
        }
      } catch (err) {
        updatePipelineSteps(4, 'cancelled');
        confirmationResultContent.innerHTML = `<span style="color:var(--coral-500);">Error: ${escapeHtml(err.message)}</span>`;
      }
    });
  }

  // 3. Slow Tool SSE Streaming
  const btnRunSlowTool = document.getElementById('btnRunSlowTool');
  const btnAbortSlowTool = document.getElementById('btnAbortSlowTool');
  const slowToolProgressFill = document.getElementById('slowToolProgressFill');
  const slowToolStepLabel = document.getElementById('slowToolStepLabel');
  const slowToolPercentLabel = document.getElementById('slowToolPercentLabel');
  const slowToolTerminal = document.getElementById('slowToolTerminal');
  const btnClearConsoleBtn = document.getElementById('btnClearConsoleBtn');

  function updateStreamBadges(step, done = false) {
    for (let i = 1; i <= 5; i++) {
      const badge = document.getElementById(`stepBadge${i}`);
      if (!badge) continue;
      if (done || i < step) {
        badge.className = 'stream-step-badge step-completed';
      } else if (i === step) {
        badge.className = 'stream-step-badge step-active';
      } else {
        badge.className = 'stream-step-badge';
      }
    }
  }

  function logTerminal(message, type = '') {
    if (!slowToolTerminal) return;
    const time = new Date().toTimeString().split(' ')[0];
    const div = document.createElement('div');
    div.className = `term-line ${type}`;
    div.innerHTML = `<span style="color:var(--text-muted)">[${time}]</span> ${message}`;
    slowToolTerminal.appendChild(div);
    slowToolTerminal.scrollTop = slowToolTerminal.scrollHeight;
  }

  if (btnClearConsoleBtn) {
    btnClearConsoleBtn.addEventListener('click', () => {
      if (slowToolTerminal) {
        slowToolTerminal.innerHTML = '<div class="term-line term-dim">[System] Console cleared. Ready for next streaming task...</div>';
      }
    });
  }

  if (btnRunSlowTool) {
    btnRunSlowTool.addEventListener('click', async () => {
      btnRunSlowTool.disabled = true;
      if (btnAbortSlowTool) btnAbortSlowTool.style.display = 'inline-flex';

      slowToolProgressFill.style.width = '0%';
      slowToolPercentLabel.textContent = '0%';
      slowToolStepLabel.textContent = 'Connecting to Server-Sent Events stream...';
      updateStreamBadges(0);

      logTerminal('⚡ Initiating GET /api/slow-tool/stream...', 'terminal-step');

      appState.slowToolAbortController = new AbortController();

      try {
        const response = await fetch('/api/slow-tool/stream', {
          signal: appState.slowToolAbortController.signal,
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        logTerminal('✓ Connected! Streaming progress events from FastMCP context...', 'terminal-success');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop(); // keep last incomplete chunk

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const eventData = JSON.parse(line.substring(6));
                const progress = eventData.progress || 0;
                slowToolProgressFill.style.width = `${progress}%`;
                slowToolPercentLabel.textContent = `${progress}%`;
                slowToolStepLabel.textContent = eventData.message;

                updateStreamBadges(eventData.step, eventData.done);

                if (eventData.done) {
                  logTerminal(`🎉 ${eventData.message} (100%) - Result: "${eventData.result}"`, 'terminal-success');
                  showToast('Slow task finished all 5 steps!', 'success');
                } else {
                  logTerminal(`→ ctx.report_progress: Step ${eventData.step}/${eventData.total} (${progress}%)`, 'terminal-step');
                }
              } catch (parseErr) {
                console.error('Error parsing SSE data:', parseErr, line);
              }
            }
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          logTerminal('⚠️ Stream aborted by user.', 'term-dim');
          slowToolStepLabel.textContent = 'Task cancelled';
          showToast('Slow task cancelled', 'info');
        } else {
          logTerminal(`✕ Stream error: ${escapeHtml(err.message)}`, 'term-line');
          showToast(`Stream error: ${err.message}`, 'error');
        }
      } finally {
        btnRunSlowTool.disabled = false;
        if (btnAbortSlowTool) btnAbortSlowTool.style.display = 'none';
        appState.slowToolAbortController = null;
      }
    });
  }

  if (btnAbortSlowTool) {
    btnAbortSlowTool.addEventListener('click', () => {
      if (appState.slowToolAbortController) {
        appState.slowToolAbortController.abort();
      }
    });
  }

  // 4. MCP Tools Registry Explorer
  const btnRefreshMcpTools = document.getElementById('btnRefreshMcpTools');
  if (btnRefreshMcpTools) {
    btnRefreshMcpTools.addEventListener('click', fetchMcpTools);
  }
  initRegistryFilters();
}

// ==========================================================================
// MCP Tool Registry Introspection System & Meta Registry
// ==========================================================================
const MCP_TOOL_METAS = {
  summarize_week: {
    icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
    iconBoxClass: 'icon-box-mono',
    badgeClass: 'badge-cat-mono',
    badgeLabel: '[AI_TOOL]',
    capability: 'Weekly Work Summarizer',
    method: 'POST',
    endpoint: '/api/summarize-week',
    paramTypes: {
      employee_name: { type: 'string', required: true, desc: 'Contributor name' },
      week_start: { type: 'YYYY-MM-DD', required: true, desc: 'Week start Monday' },
    },
    actionLabel: '[INSPECT_STUDIO]',
    actionSubtab: 'summarizer',
  },
  log_time_with_confirmation: {
    icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
    iconBoxClass: 'icon-box-mono',
    badgeClass: 'badge-cat-mono',
    badgeLabel: '[GUARD]',
    capability: 'High-Hours Confirmation Interruption',
    method: 'POST',
    endpoint: '/api/entries/with-confirmation',
    paramTypes: {
      employee_name: { type: 'string', required: true, desc: 'Contributor name' },
      project: { type: 'string', required: true, desc: 'Target project name' },
      entry_date: { type: 'YYYY-MM-DD', required: true, desc: 'Work log date' },
      hours: { type: 'number', required: true, desc: '>10h prompts for confirmation' },
      description: { type: 'string', required: false, desc: 'Work notes or task detail' },
    },
    actionLabel: '[OPEN_SANDBOX]',
    actionSubtab: 'guard',
  },
  slow_tool: {
    icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
    iconBoxClass: 'icon-box-mono',
    badgeClass: 'badge-cat-mono',
    badgeLabel: '[STREAM]',
    capability: 'Real-Time Progress Feedback',
    method: 'GET',
    endpoint: '/api/slow-tool/stream',
    paramTypes: {},
    actionLabel: '[OPEN_CONSOLE]',
    actionSubtab: 'stream',
  },
  log_time: {
    icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
    iconBoxClass: 'icon-box-mono',
    badgeClass: 'badge-cat-mono',
    badgeLabel: '[DATABASE]',
    capability: 'Direct Cloud Database Entry Logging',
    method: 'POST',

    endpoint: '/api/entries',
    paramTypes: {
      employee_name: { type: 'string', required: true, desc: 'Contributor name' },
      project: { type: 'string', required: true, desc: 'Project identifier' },
      entry_date: { type: 'YYYY-MM-DD', required: true, desc: 'Date of logged work' },
      hours: { type: 'number', required: true, desc: 'Hours logged' },
      description: { type: 'string', required: false, desc: 'Task details' },
    },
    actionLabel: '[LOG_ENTRY]',
    actionTab: 'log',
  },
  get_timesheet: {
    icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
    iconBoxClass: 'icon-box-mono',
    badgeClass: 'badge-cat-mono',
    badgeLabel: '[DATABASE]',
    capability: 'Employee Records Query',
    method: 'GET',
    endpoint: '/api/timesheet/{employee}',
    paramTypes: {
      employee_name: { type: 'string', required: true, desc: 'Employee to query' },
      start_date: { type: 'date', required: false, desc: 'Optional range start' },
      end_date: { type: 'date', required: false, desc: 'Optional range end' },
    },
    actionLabel: '[VIEW_TIMESHEET]',
    actionTab: 'timesheet',
  },
  get_project_summary: {
    icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`,
    iconBoxClass: 'icon-box-mono',
    badgeClass: 'badge-cat-mono',
    badgeLabel: '[ANALYTICS]',
    capability: 'Workload Breakdown',
    method: 'GET',
    endpoint: '/api/projects/{project}/summary',
    paramTypes: {
      project: { type: 'string', required: true, desc: 'Project name' },
    },
    actionLabel: '[VIEW_ANALYTICS]',
    actionTab: 'summary',
  },
  list_projects: {
    icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
    iconBoxClass: 'icon-box-mono',
    badgeClass: 'badge-cat-mono',
    badgeLabel: '[DATABASE]',
    capability: 'Active Projects Catalog',
    method: 'GET',
    endpoint: '/api/projects',
    paramTypes: {},
    actionLabel: '[BROWSE_PROJECTS]',
    actionTab: 'entries',
  },
  update_time_entry: {
    icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
    iconBoxClass: 'icon-box-mono',
    badgeClass: 'badge-cat-mono',
    badgeLabel: '[DATABASE]',
    capability: 'Ledger Entry Mutation',
    method: 'PUT',
    endpoint: '/api/entries/{id}',
    paramTypes: {
      entry_id: { type: 'integer', required: true, desc: 'Target ledger transaction ID' },
      employee_name: { type: 'string', required: true, desc: 'Contributor operator name' },
      project: { type: 'string', required: true, desc: 'Target project code' },
      entry_date: { type: 'YYYY-MM-DD', required: true, desc: 'Work log date (YYYY-MM-DD)' },
      hours: { type: 'number', required: true, desc: 'Logged duration in hours (> 0)' },
      description: { type: 'string', required: false, desc: 'Task notes or activity remark' },
    },
    actionLabel: '[EXECUTE_UPDATE]',
    actionTab: 'entries',
  },
  delete_time_entry: {
    icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
    iconBoxClass: 'icon-box-mono',
    badgeClass: 'badge-cat-mono',
    badgeLabel: '[DATABASE]',
    capability: 'Ledger Entry Purge',
    method: 'DELETE',
    endpoint: '/api/entries/{id}',
    paramTypes: {
      entry_id: { type: 'integer', required: true, desc: 'Target ledger transaction ID to purge' },
    },
    actionLabel: '[EXECUTE_PURGE]',
    actionTab: 'entries',
  },
};

function initRegistryFilters() {
  const filterBtns = document.querySelectorAll('.reg-filter-btn');
  const searchInput = document.getElementById('mcpToolSearchInput');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      appState.mcpToolsFilter = btn.dataset.category || 'all';
      renderMcpToolsGrid();
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      appState.mcpToolsQuery = searchInput.value.toLowerCase().trim();
      renderMcpToolsGrid();
    });
  }
}

function renderMcpToolsGrid() {
  const grid = document.getElementById('mcpToolsGrid');
  if (!grid) return;

  const filter = appState.mcpToolsFilter || 'all';
  const query = (appState.mcpToolsQuery || '').toLowerCase().trim();

  const filteredTools = appState.mcpTools.filter(t => {
    const matchesCategory = filter === 'all' || t.category === filter;
    const matchesSearch = !query ||
      t.name.toLowerCase().includes(query) ||
      (t.description && t.description.toLowerCase().includes(query)) ||
      (t.parameters && t.parameters.some(p => p.toLowerCase().includes(query)));
    return matchesCategory && matchesSearch;
  });

  const countBadge = document.getElementById('mcpToolsCountBadge');
  if (countBadge) {
    countBadge.textContent = `${filteredTools.length} Tool${filteredTools.length !== 1 ? 's' : ''} Shown`;
  }

  if (filteredTools.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 40px 20px; text-align: center; color: var(--text-muted);">
        <p style="font-size: 14px; font-weight: 600; margin-bottom: 6px;">No MCP tools matched your filter</p>
        <p style="font-size: 12px; margin: 0;">Try adjusting your search query or selecting "All Tools".</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filteredTools.map(t => {
    const meta = MCP_TOOL_METAS[t.name] || {
      icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>`,
      iconBoxClass: 'icon-box-mono',
      badgeClass: 'badge-cat-mono',
      badgeLabel: t.category,
      capability: 'FastMCP Standard Capability',
      method: 'POST',
      endpoint: `/api/${t.name}`,
      paramTypes: {},
      actionLabel: 'Inspect',
      actionTab: 'mcp',
    };

    const methodClass = 'method-' + (meta.method || 'post').toLowerCase();

    const paramsList = (t.parameters || []).map(p => {
      const pInfo = meta.paramTypes[p] || { type: 'any', required: true, desc: p };
      return `
        <div class="param-item">
          <div class="param-name-wrap">
            <span class="param-name">${escapeHtml(p)}</span>
            <span class="param-type-badge">${escapeHtml(pInfo.type)}</span>
          </div>
          <span class="param-desc" title="${escapeHtml(pInfo.desc)}">${escapeHtml(pInfo.desc)}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="mcp-tool-card" data-tool="${escapeHtml(t.name)}">
        <div class="tool-card-top">
          <div class="tool-icon-box ${meta.iconBoxClass}">
            ${meta.icon}
          </div>
          <div class="tool-head-titles">
            <div class="tool-header-row">
              <code class="tool-title-code">${escapeHtml(t.name)}()</code>
              <span class="tool-badge ${meta.badgeClass}">${meta.badgeLabel}</span>
            </div>
            <span class="tool-capability-sub">${meta.capability}</span>
          </div>
        </div>

        <p class="tool-desc">${escapeHtml(t.description)}</p>

        <div class="tool-endpoint-bar">
          <span class="endpoint-method ${methodClass}">${meta.method}</span>
          <code class="endpoint-path">${escapeHtml(meta.endpoint)}</code>
        </div>

        <div class="tool-params-section">
          <div class="params-header">
            <span>// INPUT_SCHEMA (${t.parameters ? t.parameters.length : 0})</span>
            <span class="params-hint">${t.parameters && t.parameters.length > 0 ? '[TYPES_DEFINED]' : '[NO_PARAMS]'}</span>
          </div>
          <div class="tool-params-grid">
            ${paramsList || '<span style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">// ZERO_ARGUMENTS</span>'}
          </div>
        </div>

        <div class="tool-card-actions">
          <button type="button" class="btn-tool-action btn-tool-primary" data-tool-action="${escapeHtml(t.name)}">
            <span>${meta.actionLabel}</span>
          </button>
          <button type="button" class="btn-tool-action btn-tool-secondary" data-copy-schema="${escapeHtml(t.name)}" title="Copy Tool Definition Schema">
            <span>[COPY_SCHEMA]</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Wire primary action buttons
  grid.querySelectorAll('.btn-tool-primary').forEach(btn => {
    btn.addEventListener('click', () => {
      const toolName = btn.dataset.toolAction;
      const meta = MCP_TOOL_METAS[toolName];
      if (!meta) return;

      if (toolName === 'update_time_entry') {
        if (appState.entries && appState.entries.length > 0) {
          openEditModal(appState.entries[0].id);
          showToast(`Opened editor for Entry #${appState.entries[0].id}. You can also edit any entry directly from the Data Ledger table.`, 'info', 3000);
        } else {
          if (switchTabGlobal) switchTabGlobal('entries');
          showToast('Data Ledger has no entries to edit. Log an entry first.', 'warning', 2500);
        }
      } else if (toolName === 'delete_time_entry') {
        if (appState.entries && appState.entries.length > 0) {
          openDeleteModal(appState.entries[0].id);
          showToast(`Opened purge confirmation for Entry #${appState.entries[0].id}. You can also purge any entry directly from the Data Ledger table.`, 'info', 3000);
        } else {
          if (switchTabGlobal) switchTabGlobal('entries');
          showToast('Data Ledger has no entries to purge.', 'warning', 2500);
        }
      } else if (meta.actionSubtab) {
        switchMcpSubpanel(meta.actionSubtab);
        showToast(`Switched to ${meta.actionLabel}`, 'info', 1800);
      } else if (meta.actionTab && switchTabGlobal) {
        switchTabGlobal(meta.actionTab);
        showToast(`Navigated to ${meta.actionTab} view`, 'info', 1800);
      }
    });
  });

  // Wire schema copy buttons
  grid.querySelectorAll('.btn-tool-secondary').forEach(btn => {
    btn.addEventListener('click', async () => {
      const toolName = btn.dataset.copySchema;
      const tool = appState.mcpTools.find(t => t.name === toolName);
      if (tool) {
        const meta = MCP_TOOL_METAS[tool.name] || {};
        const paramProps = (tool.parameters || []).reduce((acc, p) => {
          const pInfo = (meta.paramTypes && meta.paramTypes[p]) || { type: 'string', desc: p };
          acc[p] = { type: pInfo.type, description: pInfo.desc };
          return acc;
        }, {});
        const schema = {
          name: tool.name,
          description: tool.description,
          parameters: {
            type: 'object',
            properties: paramProps,
            required: (tool.parameters || []).filter(p => {
              const pInfo = (meta.paramTypes && meta.paramTypes[p]);
              return pInfo ? pInfo.required : true;
            }),
          },
        };
        try {
          await navigator.clipboard.writeText(JSON.stringify(schema, null, 2));
          showToast(`Schema for ${toolName}() copied to clipboard!`, 'success');
        } catch {
          showToast('Could not copy schema', 'error');
        }
      }
    });
  });
}

function updateRegistryCounts() {
  const total = appState.mcpTools.length;
  const countBadge = document.getElementById('mcpToolsCountBadge');
  if (countBadge) {
    countBadge.textContent = `[${total}_TOOLS_LOADED]`;
  }
  const tabBadge = document.getElementById('mcpToolsTabBadge');
  if (tabBadge) {
    tabBadge.textContent = `${total} TOOLS`;
  }
  const headerBadge = document.getElementById('mcpHeaderBadge');
  if (headerBadge) {
    headerBadge.innerHTML = `<span class="hazard-dot"></span> [FASTMCP: ${total} TOOLS MOUNTED]`;
  }

  // Update filter buttons dynamically based on server tool categories
  const counts = {
    all: total,
    ai: appState.mcpTools.filter(t => t.category === 'ai').length,
    interactive: appState.mcpTools.filter(t => t.category === 'interactive').length,
    demo: appState.mcpTools.filter(t => t.category === 'demo').length,
    core: appState.mcpTools.filter(t => t.category === 'core').length,
    analytics: appState.mcpTools.filter(t => t.category === 'analytics').length,
  };

  const labels = {
    all: `[ALL (${counts.all})]`,
    ai: `[GROQ_AI (${counts.ai})]`,
    interactive: `[ELICIT (${counts.interactive})]`,
    demo: `[STREAM (${counts.demo})]`,
    core: `[DATABASE (${counts.core})]`,
    analytics: `[ANALYTICS (${counts.analytics})]`,
  };

  document.querySelectorAll('.reg-filter-btn').forEach(btn => {
    const cat = btn.dataset.category;
    if (cat && labels[cat]) {
      btn.textContent = labels[cat];
    }
  });
}

async function fetchMcpTools() {
  const grid = document.getElementById('mcpToolsGrid');
  if (!grid) return;

  try {
    const res = await fetch('/api/mcp/tools');
    if (!res.ok) throw new Error('Could not fetch MCP tools');
    const data = await res.json();
    appState.mcpTools = data.tools || [];

    updateRegistryCounts();
    renderMcpToolsGrid();
  } catch (err) {
    console.error('Error fetching MCP tools:', err);
    grid.innerHTML = `<div style="grid-column: 1 / -1; color:var(--status-red); padding: 16px;">Failed to load MCP tool metadata: ${escapeHtml(err.message)}</div>`;
  }
}

// ==========================================================================
// Helpers & Telemetry Effects
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

// Technical Text Scramble Decoder Effect
function scrambleText(element, targetText, duration = 300) {
  if (!element || !targetText) return;
  const chars = '0123456789ABCDEF_#[]-/:<>';
  const startTime = performance.now();
  const len = targetText.length;

  function frame(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const resolvedCount = Math.floor(progress * len);

    let output = '';
    for (let i = 0; i < len; i++) {
      if (i < resolvedCount) {
        output += targetText[i];
      } else if (targetText[i] === ' ' || targetText[i] === '\n') {
        output += targetText[i];
      } else {
        output += chars[Math.floor(Math.random() * chars.length)];
      }
    }
    element.textContent = output;

    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      element.textContent = targetText;
    }
  }
  requestAnimationFrame(frame);
}

// Live Hardware Telemetry Clock
function initSystemClock() {
  const clockEl = document.getElementById('systemClock');
  if (!clockEl) return;
  function update() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    clockEl.textContent = `SYS_TIME: ${d.getFullYear()}.${pad(d.getMonth()+1)}.${pad(d.getDate())} // ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  update();
  setInterval(update, 1000);
}

// ==========================================================================
// Ledger Entry Actions (Edit & Delete Modals & Handlers)
// ==========================================================================
window.openEditModal = function(entryId) {
  const entry = appState.entries.find(e => Number(e.id) === Number(entryId)) || appState.entries[0];
  if (!entry) {
    showToast(`No entries found in local cache to edit`, 'error');
    return;
  }
  const editModal = document.getElementById('editEntryModal');
  if (!editModal) return;

  // Populate entry quick selector dropdown if present
  const select = document.getElementById('editEntrySelect');
  if (select && appState.entries && appState.entries.length > 0) {
    select.innerHTML = appState.entries.map(e => `
      <option value="${e.id}" ${Number(e.id) === Number(entry.id) ? 'selected' : ''}>
        #${e.id} :: ${escapeHtml(e.employee_name)} [${escapeHtml(e.project)}] - ${parseFloat(e.hours).toFixed(1)}h (${escapeHtml(e.entry_date)})
      </option>
    `).join('');
  }

  document.getElementById('editEntryId').value = entry.id;
  document.getElementById('editEmployeeInput').value = entry.employee_name || '';
  document.getElementById('editProjectInput').value = entry.project || '';
  document.getElementById('editDateInput').value = entry.entry_date || '';
  document.getElementById('editHoursInput').value = entry.hours || '';
  document.getElementById('editDescInput').value = entry.description || '';

  editModal.style.display = 'flex';
};

window.closeEditModal = function() {
  const editModal = document.getElementById('editEntryModal');
  if (editModal) editModal.style.display = 'none';
};

function renderDeletePreview(item) {
  const preview = document.getElementById('deleteModalPreview');
  if (!preview || !item) return;
  preview.innerHTML = `
    <div class="modal-preview-row">
      <span style="color:var(--text-muted);font-weight:700;">ENTRY_ID:</span>
      <strong style="color:var(--hazard-orange);">#${item.id}</strong>
    </div>
    <div class="modal-preview-row">
      <span style="color:var(--text-muted);font-weight:700;">OPERATOR:</span>
      <strong>${escapeHtml(item.employee_name)}</strong>
    </div>
    <div class="modal-preview-row">
      <span style="color:var(--text-muted);font-weight:700;">PROJECT:</span>
      <strong>${escapeHtml(item.project)}</strong>
    </div>
    <div class="modal-preview-row">
      <span style="color:var(--text-muted);font-weight:700;">DATE // HOURS:</span>
      <strong>${escapeHtml(item.entry_date)} // ${parseFloat(item.hours).toFixed(2)} HRS</strong>
    </div>
    ${item.description ? `
    <div class="modal-preview-row">
      <span style="color:var(--text-muted);font-weight:700;">TASK REMARK:</span>
      <span>${escapeHtml(item.description)}</span>
    </div>` : ''}
  `;
}

window.openDeleteModal = function(entryId) {
  const entry = appState.entries.find(e => Number(e.id) === Number(entryId)) || appState.entries[0];
  if (!entry) {
    showToast(`No entries found in local cache to purge`, 'error');
    return;
  }
  const deleteModal = document.getElementById('deleteEntryModal');
  if (!deleteModal) return;

  deleteModal.dataset.entryId = String(entry.id);

  // Populate entry quick selector dropdown if present
  const select = document.getElementById('deleteEntrySelect');
  if (select && appState.entries && appState.entries.length > 0) {
    select.innerHTML = appState.entries.map(e => `
      <option value="${e.id}" ${Number(e.id) === Number(entry.id) ? 'selected' : ''}>
        #${e.id} :: ${escapeHtml(e.employee_name)} [${escapeHtml(e.project)}] - ${parseFloat(e.hours).toFixed(1)}h (${escapeHtml(e.entry_date)})
      </option>
    `).join('');
  }

  renderDeletePreview(entry);
  deleteModal.style.display = 'flex';
};

window.closeDeleteModal = function() {
  const deleteModal = document.getElementById('deleteEntryModal');
  if (deleteModal) {
    deleteModal.style.display = 'none';
    delete deleteModal.dataset.entryId;
  }
};

function initLedgerActions() {
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const editModal = document.getElementById('editEntryModal');
  const editForm = document.getElementById('editEntryForm');
  const editEntrySelect = document.getElementById('editEntrySelect');

  if (editEntrySelect) {
    editEntrySelect.addEventListener('change', () => {
      const selectedId = editEntrySelect.value;
      const target = appState.entries.find(e => Number(e.id) === Number(selectedId));
      if (target) {
        document.getElementById('editEntryId').value = target.id;
        document.getElementById('editEmployeeInput').value = target.employee_name || '';
        document.getElementById('editProjectInput').value = target.project || '';
        document.getElementById('editDateInput').value = target.entry_date || '';
        document.getElementById('editHoursInput').value = target.hours || '';
        document.getElementById('editDescInput').value = target.description || '';
      }
    });
  }

  if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', closeEditModal);
  }

  if (editModal) {
    editModal.addEventListener('click', (e) => {
      if (e.target === editModal) closeEditModal();
    });
  }

  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('editEntryId').value;
      const employee = document.getElementById('editEmployeeInput').value.trim();
      const project = document.getElementById('editProjectInput').value.trim();
      const date = document.getElementById('editDateInput').value;
      const hours = parseFloat(document.getElementById('editHoursInput').value);
      const desc = document.getElementById('editDescInput').value.trim();

      if (!employee || !project || !date || isNaN(hours) || hours <= 0) {
        showToast('Please validate all required fields with positive hours (>0)', 'warning');
        return;
      }

      const saveBtn = document.getElementById('saveEditBtn');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'COMMITTING...';
      }

      try {
        const res = await fetch(`/api/entries/${id}`, {
          method: 'PUT',
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
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || 'Failed to update entry');
        }

        closeEditModal();
        showToast(`Entry #${id} updated successfully!`, 'success');
        await fetchEntries();
        await fetchProjects();
      } catch (err) {
        console.error('Error updating entry:', err);
        showToast(`Update failed: ${err.message}`, 'error');
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = '<span>[SAVE_CHANGES]</span>';
        }
      }
    });
  }

  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  const deleteModal = document.getElementById('deleteEntryModal');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  const deleteEntrySelect = document.getElementById('deleteEntrySelect');

  if (deleteEntrySelect) {
    deleteEntrySelect.addEventListener('change', () => {
      const selectedId = deleteEntrySelect.value;
      const target = appState.entries.find(e => Number(e.id) === Number(selectedId));
      if (target) {
        deleteModal.dataset.entryId = String(target.id);
        renderDeletePreview(target);
      }
    });
  }

  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', closeDeleteModal);
  }

  if (deleteModal) {
    deleteModal.addEventListener('click', (e) => {
      if (e.target === deleteModal) closeDeleteModal();
    });
  }

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async () => {
      const id = deleteModal ? deleteModal.dataset.entryId : null;
      if (!id) return;

      confirmDeleteBtn.disabled = true;
      confirmDeleteBtn.textContent = 'PURGING...';

      try {
        const res = await fetch(`/api/entries/${id}`, {
          method: 'DELETE',
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || 'Failed to delete entry');
        }

        closeDeleteModal();
        showToast(`Entry #${id} purged from ProjectMapAI ledger`, 'info');
        await fetchEntries();
        await fetchProjects();
      } catch (err) {
        console.error('Error deleting entry:', err);
        showToast(`Delete failed: ${err.message}`, 'error');
      } finally {
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.innerHTML = '<span>[CONFIRM_PURGE]</span>';
      }
    });
  }

  // Keyboard shortcut: ESC closes open modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeEditModal();
      closeDeleteModal();
    }
  });
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
  initMcpLab();
  initSystemClock();
  initLedgerActions();

  // Load initial data
  fetchEntries();
  fetchProjects();
  fetchMcpTools();
});

