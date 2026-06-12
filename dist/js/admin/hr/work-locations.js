(function () {
    const STORAGE_KEY = 'marga.hr.workLocations.v1';
    const OFFICE_MAX_METERS = 30;
    const PRODUCTION_MAX_METERS = 30;
    const CUSTOMER_SITE_MAX_METERS = 100;

    const DEFAULT_LOCATIONS = [
        {
            id: 'havila-office',
            name: 'Havila Office',
            type: 'office',
            address: '',
            latitude: '',
            longitude: '',
            allowedMeters: 20,
            requiresPincode: true,
            isActive: true
        },
        {
            id: 'production-office',
            name: 'Production Office',
            type: 'production',
            address: '',
            latitude: '',
            longitude: '',
            allowedMeters: 20,
            requiresPincode: true,
            isActive: true
        }
    ];

    const typeLabels = {
        office: 'Office',
        production: 'Production',
        customer_site: 'Customer Site',
        temporary_site: 'Temporary Site'
    };

    const state = {
        locations: loadLocations()
    };

    function maxMetersForType(type) {
        if (type === 'customer_site' || type === 'temporary_site') return CUSTOMER_SITE_MAX_METERS;
        if (type === 'production') return PRODUCTION_MAX_METERS;
        return OFFICE_MAX_METERS;
    }

    function clampAllowedMeters(type, value) {
        const numericValue = Number(value) || 5;
        return Math.min(Math.max(numericValue, 5), maxMetersForType(type));
    }

    function toRadians(value) {
        return Number(value) * Math.PI / 180;
    }

    function distanceMeters(from, to) {
        const earthRadiusMeters = 6371000;
        const lat1 = toRadians(from.latitude);
        const lat2 = toRadians(to.latitude);
        const deltaLat = toRadians(Number(to.latitude) - Number(from.latitude));
        const deltaLng = toRadians(Number(to.longitude) - Number(from.longitude));
        const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2)
            + Math.cos(lat1) * Math.cos(lat2)
            * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return earthRadiusMeters * c;
    }

    function validateTimeIn(location, employeePoint) {
        if (!location || !location.isActive) {
            return { allowed: false, reason: 'Assigned work location is inactive or missing.' };
        }

        if (!hasCoordinates(location)) {
            return { allowed: false, reason: `${location.name} has no pinned GPS coordinates yet.` };
        }

        if (!hasCoordinates(employeePoint)) {
            return { allowed: false, reason: 'Employee GPS point is missing.' };
        }

        const allowedMeters = clampAllowedMeters(location.type, location.allowedMeters);
        const actualDistance = distanceMeters(location, employeePoint);

        if (actualDistance <= allowedMeters) {
            return {
                allowed: true,
                distanceMeters: actualDistance,
                allowedMeters,
                reason: `Allowed. Employee is ${actualDistance.toFixed(1)}m from ${location.name}.`
            };
        }

        return {
            allowed: false,
            distanceMeters: actualDistance,
            allowedMeters,
            reason: `Blocked. Employee is ${actualDistance.toFixed(1)}m away; limit is ${allowedMeters}m.`
        };
    }

    function hasCoordinates(value) {
        return value
            && value.latitude !== ''
            && value.longitude !== ''
            && Number.isFinite(Number(value.latitude))
            && Number.isFinite(Number(value.longitude));
    }

    function loadLocations() {
        if (typeof window === 'undefined' || typeof localStorage === 'undefined') return DEFAULT_LOCATIONS;

        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            if (Array.isArray(stored) && stored.length) return stored;
        } catch (error) {
            console.warn('Could not read HR locations from local storage.', error);
        }
        return DEFAULT_LOCATIONS;
    }

    function saveLocations() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.locations));
    }

    function getElements() {
        return {
            form: document.getElementById('locationForm'),
            locationId: document.getElementById('locationId'),
            locationName: document.getElementById('locationName'),
            locationType: document.getElementById('locationType'),
            locationAddress: document.getElementById('locationAddress'),
            latitude: document.getElementById('latitude'),
            longitude: document.getElementById('longitude'),
            allowedMeters: document.getElementById('allowedMeters'),
            allowedMetersLabel: document.getElementById('allowedMetersLabel'),
            requiresPincode: document.getElementById('requiresPincode'),
            isActive: document.getElementById('isActive'),
            formNotice: document.getElementById('formNotice'),
            locationList: document.getElementById('locationList'),
            previewLocation: document.getElementById('previewLocation'),
            employeeLatitude: document.getElementById('employeeLatitude'),
            employeeLongitude: document.getElementById('employeeLongitude'),
            eligibilityResult: document.getElementById('eligibilityResult')
        };
    }

    function init() {
        const elements = getElements();
        updateMeterLimit(elements);
        renderLocations(elements);
        resetForm(elements, state.locations[0]);

        elements.locationType.addEventListener('change', () => updateMeterLimit(elements));
        elements.allowedMeters.addEventListener('input', () => updateMeterLabel(elements));
        elements.form.addEventListener('submit', (event) => {
            event.preventDefault();
            saveForm(elements);
        });

        document.getElementById('newLocationBtn').addEventListener('click', () => resetForm(elements));
        document.getElementById('useCurrentLocationBtn').addEventListener('click', () => fillCurrentGps(elements.latitude, elements.longitude, elements.formNotice));
        document.getElementById('useEmployeeGpsBtn').addEventListener('click', () => fillCurrentGps(elements.employeeLatitude, elements.employeeLongitude, elements.eligibilityResult));
        document.getElementById('checkEligibilityBtn').addEventListener('click', () => previewEligibility(elements));
    }

    function updateMeterLimit(elements) {
        const max = maxMetersForType(elements.locationType.value);
        elements.allowedMeters.max = String(max);
        elements.allowedMeters.value = String(clampAllowedMeters(elements.locationType.value, elements.allowedMeters.value));
        updateMeterLabel(elements);
    }

    function updateMeterLabel(elements) {
        elements.allowedMetersLabel.textContent = `${elements.allowedMeters.value}m`;
    }

    function resetForm(elements, location) {
        const current = location || {
            id: '',
            name: '',
            type: 'office',
            address: '',
            latitude: '',
            longitude: '',
            allowedMeters: 20,
            requiresPincode: true,
            isActive: true
        };

        elements.locationId.value = current.id;
        elements.locationName.value = current.name;
        elements.locationType.value = current.type;
        elements.locationAddress.value = current.address || '';
        elements.latitude.value = current.latitude;
        elements.longitude.value = current.longitude;
        elements.allowedMeters.value = clampAllowedMeters(current.type, current.allowedMeters);
        elements.requiresPincode.checked = Boolean(current.requiresPincode);
        elements.isActive.checked = current.isActive !== false;
        setNotice(elements.formNotice, '', '');
        updateMeterLimit(elements);
    }

    function saveForm(elements) {
        const type = elements.locationType.value;
        const location = {
            id: elements.locationId.value || slugify(elements.locationName.value),
            name: elements.locationName.value.trim(),
            type,
            address: elements.locationAddress.value.trim(),
            latitude: elements.latitude.value,
            longitude: elements.longitude.value,
            allowedMeters: clampAllowedMeters(type, elements.allowedMeters.value),
            requiresPincode: elements.requiresPincode.checked,
            isActive: elements.isActive.checked,
            updatedAt: new Date().toISOString()
        };

        if (!location.name) {
            setNotice(elements.formNotice, 'Location name is required.', 'error');
            return;
        }

        if (!hasCoordinates(location)) {
            setNotice(elements.formNotice, 'Latitude and longitude are required before this pin can be used for time-in.', 'error');
            return;
        }

        const existingIndex = state.locations.findIndex((item) => item.id === location.id);
        if (existingIndex >= 0) {
            state.locations[existingIndex] = location;
        } else {
            state.locations.push(location);
        }

        saveLocations();
        renderLocations(elements);
        resetForm(elements, location);
        setNotice(elements.formNotice, `${location.name} saved with a ${location.allowedMeters}m limit.`, 'success');
    }

    function renderLocations(elements) {
        elements.locationList.innerHTML = '';
        elements.previewLocation.innerHTML = '';

        state.locations.forEach((location) => {
            const card = document.createElement('article');
            card.className = 'location-card';
            card.innerHTML = `
                <header>
                    <div>
                        <h3>${escapeHtml(location.name)}</h3>
                        <p>${escapeHtml(location.address || 'No address set yet')}</p>
                    </div>
                    <span class="pill ${location.isActive ? '' : 'inactive'}">${location.isActive ? 'Active' : 'Inactive'}</span>
                </header>
                <div class="location-meta">
                    <span class="pill">${typeLabels[location.type] || location.type}</span>
                    <span class="pill">${clampAllowedMeters(location.type, location.allowedMeters)}m max</span>
                    <span class="pill ${hasCoordinates(location) ? '' : 'warning'}">${hasCoordinates(location) ? `${location.latitude}, ${location.longitude}` : 'Needs GPS pin'}</span>
                    <span class="pill">${location.requiresPincode ? 'Pincode required' : 'No pincode'}</span>
                </div>
                <div class="card-actions">
                    <button type="button" class="text-btn" data-edit="${location.id}">Edit</button>
                    <button type="button" class="text-btn" data-toggle="${location.id}">${location.isActive ? 'Disable' : 'Enable'}</button>
                </div>
            `;
            elements.locationList.appendChild(card);

            const option = document.createElement('option');
            option.value = location.id;
            option.textContent = location.name;
            elements.previewLocation.appendChild(option);
        });

        elements.locationList.querySelectorAll('[data-edit]').forEach((button) => {
            button.addEventListener('click', () => {
                resetForm(elements, state.locations.find((location) => location.id === button.dataset.edit));
            });
        });

        elements.locationList.querySelectorAll('[data-toggle]').forEach((button) => {
            button.addEventListener('click', () => {
                const location = state.locations.find((item) => item.id === button.dataset.toggle);
                location.isActive = !location.isActive;
                saveLocations();
                renderLocations(elements);
            });
        });
    }

    function previewEligibility(elements) {
        const location = state.locations.find((item) => item.id === elements.previewLocation.value);
        const employeePoint = {
            latitude: elements.employeeLatitude.value,
            longitude: elements.employeeLongitude.value
        };
        const result = validateTimeIn(location, employeePoint);
        elements.eligibilityResult.className = `eligibility-result ${result.allowed ? 'allowed' : 'blocked'}`;
        elements.eligibilityResult.textContent = result.reason;
    }

    function fillCurrentGps(latitudeInput, longitudeInput, noticeElement) {
        if (!navigator.geolocation) {
            setNotice(noticeElement, 'This browser does not support GPS location.', 'error');
            return;
        }

        setNotice(noticeElement, 'Reading current GPS location...', 'neutral');
        navigator.geolocation.getCurrentPosition((position) => {
            latitudeInput.value = position.coords.latitude.toFixed(6);
            longitudeInput.value = position.coords.longitude.toFixed(6);
            setNotice(noticeElement, `GPS captured with ${Math.round(position.coords.accuracy)}m device accuracy.`, 'success');
        }, () => {
            setNotice(noticeElement, 'GPS permission was denied or unavailable.', 'error');
        }, {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 0
        });
    }

    function setNotice(element, message, mode) {
        element.textContent = message;
        if (element.id === 'eligibilityResult') {
            element.className = `eligibility-result ${mode === 'success' ? 'allowed' : mode === 'error' ? 'blocked' : 'neutral'}`;
            return;
        }
        element.className = `notice ${mode || ''}`;
    }

    function slugify(value) {
        return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `location-${Date.now()}`;
    }

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[char]));
    }

    if (typeof window !== 'undefined') {
        window.MargaHrWorkLocations = {
            maxMetersForType,
            clampAllowedMeters,
            distanceMeters,
            validateTimeIn
        };

        document.addEventListener('DOMContentLoaded', init);
    }

    if (typeof module !== 'undefined') {
        module.exports = {
            maxMetersForType,
            clampAllowedMeters,
            distanceMeters,
            validateTimeIn,
            constants: {
                OFFICE_MAX_METERS,
                PRODUCTION_MAX_METERS,
                CUSTOMER_SITE_MAX_METERS
            }
        };
    }
}());
