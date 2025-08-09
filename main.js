  const predefinedGroups = {
    MemoryMark: {
      groupName: 'Memory Benchmark',
      groupValue: 0,
      XMP: 'Enabled',
      tRAS: 75,
      metrics: [
        { label: "Database Operations", placeholder: 0 },
        { label: "Memory Read Uncached", placeholder: 0 },
        { label: "Available RAM", placeholder: 0 },
        { label: "Memory Threaded", placeholder: 0 },
        { label: "Memory Read Cached", placeholder: 0 },
        { label: "Memory Write", placeholder: 0 },
        { label: "Memory Latency", placeholder: 0 }
      ]
    },
    CPUMark: {
      groupName: 'CPU Benchmark',
      groupValue: 36477,
      XMP: '',
      tRAS: '',
      metrics: [
        { label: "Integer Math", placeholder: 0 },
        { label: "Prime Numbers", placeholder: 0 },
        { label: "Compression", placeholder: 0 },
        { label: "Physics", placeholder: 0 },
        { label: "CPU Single Threaded", placeholder: 0 },
        { label: "Floating Point Math", placeholder: 0 },
        { label: "Extended Instructions (SSE)", placeholder: 0 },
        { label: "Encryption", placeholder: 0 },
        { label: "Sorting", placeholder: 0 }
      ]
    },
    TestMark: {
      groupName: 'Test Benchmark',
      groupValue: 12,
      XMP: '',
      tRAS: '',
      metrics: [
        { label: "Metric 0", value: 1 },
        { label: "Metric 1", value: 10 },
        { label: "Metric 2", value: 50 },
        { label: "Metric 3", value: 100 },
        { label: "Metric 4", value: 1000 },
        { label: "Metric 5", value: 2500 },
        { label: "Metric 6", value: 5000 },
        { label: "Metric 7", value: 10000 },
        { label: "Metric 8", value: 50000 },
        { label: "Metric 9", value: 100000 },
        { label: "Metric 10", value: 250000 },
        { label: "Metric 11", value: 500000 },
        { label: "Metric 12", value: 999000 }        
      ]
    }
  };

  let data = [];

  const metricsContainer = document.getElementById('metricsContainer');
  const groupNameInput = document.getElementById('groupName');
  const groupValueInput = document.getElementById('groupValue');
  const groupNoteInput = document.getElementById('groupNote');
  const groupXMPInput = document.getElementById('groupXMP');
  const groupTRASInput = document.getElementById('groupTRAS');
  const predefinedSelect = document.getElementById('predefinedGroupSelect');
  const graph = document.getElementById('graph');

  predefinedSelect.addEventListener('change', () => {
    const selected = predefinedSelect.value;
    if (!selected) {
      groupNameInput.value = '';
      groupValueInput.value = '';
      groupNoteInput.value = '';
      groupXMPInput.value = '';
      groupTRASInput.value = '';
      metricsContainer.innerHTML = '';
      return;
    }
    const preset = predefinedGroups[selected];
    groupNameInput.value = preset.groupName;
    groupValueInput.value = groupValueInput.placeholder;
    groupNoteInput.value = '';
    groupXMPInput.value = preset.XMP || '';
    groupTRASInput.value = preset.tRAS || '';
    metricsContainer.innerHTML = '';
    preset.metrics.forEach(m => {
      addMetricField(m.label, m.value, m.placeholder);
    });
  });

  function addMetricField(label = '', value = '', placeholder = 0) {
    const div = document.createElement('div');
    div.className = 'metric-input-row';
    div.innerHTML = `
      <input placeholder="Metric Label" value="${label}" />
      <input placeholder="${placeholder}" value="${value}" />
      <button onclick="this.parentNode.remove()">Remove</button>
    `;
    metricsContainer.appendChild(div);
  }

  function addGroup() {
    const groupName = groupNameInput.value.trim();
    const groupValueRaw = groupValueInput.value.trim();
    const groupValue = groupValueRaw === '' ? null : parseInt(groupValueRaw);
    const groupNote = groupNoteInput.value.trim();
    const groupXMP = groupXMPInput.value.trim();
    const groupTRAS = groupTRASInput.value.trim() === '' ? '' : parseInt(groupTRASInput.value);

    let metrics = [];
    metricsContainer.querySelectorAll('.metric-input-row').forEach(div => {
      const inputs = div.querySelectorAll('input');
      const label = inputs[0].value.trim();
      let val = inputs[1].value.trim();
      val = val === '' ? 0 : Number(val);
      if (label) {
        metrics.push({ label, value: val });
      }
    });

    data.push({ groupName, groupValue, groupNote, XMP: groupXMP, tRAS: groupTRAS, metrics, showDetails: true });

    predefinedSelect.value = '';
    groupNameInput.value = '';
    groupValueInput.value = '';
    groupNoteInput.value = '';
    groupXMPInput.value = '';
    groupTRASInput.value = '';
    metricsContainer.innerHTML = '';

    renderGraph();
  }

  function toggleDetails(index) {
    data[index].showDetails = !data[index].showDetails;
    renderGraph();
  }

  function renderGraph() {
    graph.innerHTML = '';
    const maxVal = Math.log10(999999);

    data.forEach((entry, i) => {
      const group = document.createElement('div');
      group.className = 'group';

      let titleText = '';
      if (entry.groupName) titleText += entry.groupName;
      if (entry.groupValue !== null && !isNaN(entry.groupValue)) {
        if (titleText) titleText += ': ';
        titleText += entry.groupValue;
      }

      const title = document.createElement('div');
      title.className = 'group-title';
      title.innerHTML = `${titleText} <button class="toggle-btn" onclick="toggleDetails(${i})">Toggle</button>`;
      group.appendChild(title);

      if (entry.groupNote) {
        const noteDiv = document.createElement('div');
        noteDiv.textContent = entry.groupNote;
        group.appendChild(noteDiv);
      }

      if (entry.showDetails) {
        if (entry.XMP) group.appendChild(document.createElement('div')).textContent = `XMP: ${entry.XMP}`;
        if (entry.tRAS !== '') group.appendChild(document.createElement('div')).textContent = `tRAS: ${entry.tRAS}`;

        entry.metrics.forEach(metric => {
          const row = document.createElement('div');
          row.className = 'bar-row';

          const label = document.createElement('div');
          label.className = 'bar-label';
          label.textContent = metric.label;

          row.appendChild(label);

          const bar = document.createElement('div');
          bar.className = 'bar';
          const inner = document.createElement('div');
          inner.className = 'bar-inner';
          inner.style.width = `${(Math.log10(Math.max(metric.value, 1)) / maxVal) * 100}%`;

          const val = document.createElement('div');
          val.className = 'bar-value';
          val.textContent = metric.value;

          bar.appendChild(inner);
          bar.appendChild(val);
          row.appendChild(bar);
          group.appendChild(row);
        });
      }

      graph.appendChild(group);
    });
  }

  renderGraph();
