// modules/profile.js
// Handles OBS connection profiles in localStorage and selection modal

export function getProfiles() {
  return JSON.parse(localStorage.getItem("obsProfiles") || "[]");
}

export function saveProfiles(profiles) {
  localStorage.setItem("obsProfiles", JSON.stringify(profiles));
}

export function getActiveProfile() {
  return JSON.parse(localStorage.getItem("activeOBSProfile") || "null");
}

export function setActiveProfile(profile) {
  localStorage.setItem("activeOBSProfile", JSON.stringify(profile));
}

export function showProfileModal(onSelect) {
  // Create modal HTML
  let modal = document.getElementById("profileModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "profileModal";
    modal.innerHTML = `
      <div class="modal-backdrop" style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:#0008;z-index:9998;"></div>
      <div class="modal d-block" tabindex="-1" style="z-index:9999;display:block;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);max-width:400px;width:90vw;">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Select OBS Connection</h5>
            </div>
            <div class="modal-body">
              <div id="profileList"></div>
              <hr/>
              <form id="addProfileForm">
                <input class="form-control mb-2" name="name" placeholder="Profile name" required />
                <input class="form-control mb-2" name="ip" placeholder="IP Address (default: localhost)" />
                <input class="form-control mb-2" name="port" type="number" placeholder="Port (default: 4455)" />
                <input class="form-control mb-2" name="password" placeholder="Password" />
                <div class="d-flex gap-2 mb-2">
                  <button class="btn btn-primary w-100" type="submit">Save Profile</button>
                  <button class="btn btn-secondary w-100" id="testConnBtn" type="button">Test Connection</button>
                </div>
                <div id="profileError" class="text-danger small mb-2"></div>
              </form>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  // Render profiles
  function renderProfiles(editIdx = null) {
    const profiles = getProfiles();
    const listDiv = modal.querySelector("#profileList");
    listDiv.innerHTML = profiles.length
      ? profiles.map((p, i) => editIdx === i ? `
        <form class='editProfileForm mb-2 border p-2' data-edit='${i}'>
          <input class='form-control mb-1' name='name' value='${p.name}' required />
          <input class='form-control mb-1' name='ip' value='${p.ip||''}' placeholder='IP Address' />
          <input class='form-control mb-1' name='port' value='${p.port||''}' placeholder='Port' />
          <input class='form-control mb-1' name='password' value='${p.password||''}' placeholder='Password' />
          <div class='d-flex gap-2 mt-1'>
            <button class='btn btn-success btn-sm' type='submit'>Save</button>
            <button class='btn btn-secondary btn-sm' type='button' data-canceledit='${i}'>Cancel</button>
          </div>
        </form>
      ` : `
        <div class="d-flex justify-content-between align-items-center mb-2 border p-2">
          <div>
            <strong>${p.name}</strong><br />
            ${p.ip || 'localhost'}:${p.port || 4455}
          </div>
          <div>
            <button class="btn btn-sm btn-success" data-connect="${i}">Connect</button>
            <button class="btn btn-sm btn-warning" data-edit="${i}">Edit</button>
            <button class="btn btn-sm btn-danger" data-remove="${i}">Delete</button>
          </div>
        </div>
      `).join("")
      : "<p>No profiles saved.</p>";
  }
  renderProfiles();
  // Connect/delete/edit handlers
  modal.onclick = (e) => {
    if (e.target.dataset.connect) {
      const idx = +e.target.dataset.connect;
      const profiles = getProfiles();
      setActiveProfile(profiles[idx]);
      modal.remove();
      onSelect && onSelect(profiles[idx]);
    } else if (e.target.dataset.remove) {
      const idx = +e.target.dataset.remove;
      const profiles = getProfiles();
      profiles.splice(idx, 1);
      saveProfiles(profiles);
      renderProfiles();
    } else if (e.target.dataset.edit) {
      renderProfiles(+e.target.dataset.edit);
    } else if (e.target.dataset.canceledit) {
      renderProfiles();
    }
  };
  // Edit profile form handler
  modal.addEventListener('submit', (e) => {
    if (e.target.classList.contains('editProfileForm')) {
      e.preventDefault();
      const idx = +e.target.dataset.edit;
      const form = new FormData(e.target);
      const profiles = getProfiles();
      profiles[idx] = {
        name: form.get('name'),
        ip: form.get('ip'),
        port: form.get('port'),
        password: form.get('password')
      };
      saveProfiles(profiles);
      renderProfiles();
    }
  });
  // Add profile handler
  modal.querySelector("#addProfileForm").onsubmit = (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const newProfile = {
      name: form.get("name"),
      ip: form.get("ip"),
      port: form.get("port"),
      password: form.get("password")
    };
    if (!newProfile.name) {
      modal.querySelector('#profileError').textContent = 'Profile name is required.';
      return;
    }
    modal.querySelector('#profileError').textContent = '';
    const profiles = getProfiles();
    profiles.push(newProfile);
    saveProfiles(profiles);
    e.target.reset();
    renderProfiles();
  };
  // Test connection button
  modal.querySelector('#testConnBtn').onclick = async () => {
    const form = new FormData(modal.querySelector('#addProfileForm'));
    const ip = form.get('ip') || 'localhost';
    const port = form.get('port') || '4455';
    const password = form.get('password') || '';
    modal.querySelector('#profileError').textContent = 'Testing connection...';
    try {
      const resp = await fetch('/api/verify-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, port, password })
      });
      const data = await resp.json();
      if (data.connected) {
        modal.querySelector('#profileError').textContent = 'Connection successful!';
      } else {
        modal.querySelector('#profileError').textContent = 'Connection failed: ' + (data.error || 'Unknown error');
      }
    } catch (err) {
      modal.querySelector('#profileError').textContent = 'Connection failed: ' + err.message;
    }
  };
}
