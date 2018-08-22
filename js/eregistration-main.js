/* 
	Copyright (c) 2018 University of Colombo Clinical Society
	Faculty of Medicine, University of Colombo
*/

// Globals
var scanner = null;
var active_camera = 1;
var camera_mirror = false;
var datastore = null;
var datatable = null;

$(document).ready(function() {
    datastore = localforage.createInstance({ name: 'registered-members' });
    $('#qr-start-btn').click(init_scanner);
    $('#qr-stop-btn').click(stop_scanner);
    $('#qr-mirror-camera-btn').click(toggle_camera_mirror);
    $('#qr-change-camera-btn').click(toggle_active_camera);

    $('#manual-entry-form').submit(function (event) {
        scan_code($('#manual-text-input').val()).then(function() {
            $('#manual-text-input').select();
        });
        event.preventDefault();
    });

    $('#refresh-data-btn').click(refresh_data);
    $('#delete-record-btn').click(delete_record);
    $('#delete-scan-btn').click(delete_scan_timestamp);
    $('#save-data-btn').click(export_data);
    $('#load-data-btn').click(import_data);
    $('#reset-data-btn').click(reset_data);
    
    datatable = $('#data-table').DataTable({ 
        paging: false, 
        select: true,
        data: {} });
    datatable.on('select deselect', update_table_editing_buttons);
    refresh_data();
});

async function init_scanner() {
    loading_indicator(true);
    scanner = new Instascan.Scanner({ video: document.getElementById('qr-preview'), mirror: camera_mirror });
    scanner.addListener('scan', function (content) {
        scan_code(content);
        stop_scanner();
    });
    return activate_camera(scanner, active_camera).then(function () {
        $('#manual-entry-panel').addClass('hidden');
        $('#qr-panel').removeClass('hidden');
        loading_indicator(false);
    }).catch(function (e) {
        handle_error('Error accessing camera! Check permissions!', e);
        loading_indicator(false);
    });
}

async function stop_scanner() {
    if (scanner != null) {
        return scanner.stop().then(function () {
            $('#manual-entry-panel').removeClass('hidden');
            $('#qr-panel').addClass('hidden');
            scanner = null;
        }).catch(function (e) {
            handle_error('Error shutting down camera! Check permissions!', e);
        });;
    }
}

async function activate_camera(scanner, camera_index) {
    let cameras = await Instascan.Camera.getCameras();
    if (cameras.length > 0) {
        if (camera_index < 0 || camera_index >= cameras.length)
            camera_index = 0;
        return scanner.start(cameras[camera_index]).then(function () {
            active_camera = camera_index;
        });
    } else {
        handle_error('No cameras found on your device! Check permissions!');
    }
}

function toggle_active_camera() {
    stop_scanner().then(function () {
        active_camera += 1;
        init_scanner();
    }).catch(function (e) {
        handle_error('Error changing camera! Check permissions!', e);
    });;
}

function toggle_camera_mirror() {
    stop_scanner().then(function () {
        camera_mirror = ! camera_mirror;
        init_scanner();
    }).catch(function (e) {
        handle_error('Error flipping camera image! Check permissions!', e);
    });;
}

async function scan_code(code) {
    try {
        code = String(code).trim();
        if (code.length == 0)
            return null;
        if (! code.startsWith('UCCS/')) {
            let result = await show_confirmation('This does not look like an UCCS ID! Add anyway?');
            if (! result)
                return null;
        }
        let record = await datastore.getItem(code);
        if (record == null) {
            let result = await show_confirmation('This person is not in the list of registered people! Add anyway?')
            if (! result)
                return null;
            record = {
                id: code,
                name: null,
                registration_timestamp: null,
                scan_timestamp: new Date(),
                walk_in: true
            };
            await datastore.setItem(code, record);
    
        } else if (record.scan_timestamp != null) {
            await show_alert('This person has already been added at ' + record.scan_timestamp.toLocaleString('en-GB'));
            return null;
            
        } else {
            let result = await show_confirmation('Add ' + code + '?');
            if (! result)
                return null;
            record.scan_timestamp = new Date();
            await datastore.setItem(code, record);
        }
        return record;
    } catch (error) {
        await handle_error('Error reading/writing locally stored data', error);
    } finally {
        refresh_data();
    }
}

function refresh_data() {
    datatable.clear();
    datastore.iterate(function (record, id, i) {
        datatable.row.add([
            s.escapeHTML(record.id),
            s.escapeHTML(record.name == null ? '<Unknown>' : record.name),
            s.escapeHTML(record.walk_in == true ? '<Walk-in>' : new Date(record.registration_timestamp).toLocaleString('en-GB')),
            s.escapeHTML(record.scan_timestamp == null ? '' : new Date(record.scan_timestamp).toLocaleString('en-GB'))
        ]);
    }).then(function() {
        datatable.draw();
    }).catch(function (e) {
        handle_error('Could not read data from local storage', e);
        datatable.draw();
    });
}

function reset_data() {
    show_confirmation('Clear all local data?').then(function (result) {
        if (! result)
            return;
        datastore.clear().then(function () {
            refresh_data();
        }); 
    });
}

function delete_record() {
    let rows = datatable.rows({selected: true});
    let rows_data = rows.data();
    if (rows.count() < 1) {
        show_alert('No rows selected!');
        return;
    }
    show_confirmation(sprintf('Delete %d row(s)?', rows.count())).then(function (result) {
        if (! result)
            return;
        let promises = [];
        for (let i = 0; i < rows.count(); i++) {
            let id = rows_data[i][0];   //First column of row = ID
            promises.push(datastore.getItem(id).then(function (item) {
                promises.push(datastore.removeItem(id));
            }));
        }
        Promise.all(promises).then(function () {
            refresh_data();
            update_table_editing_buttons();
        }).catch(function (e) { 
            handle_error('Could not read/write local storage', e);
        });
    });
}

function delete_scan_timestamp() {
    let rows = datatable.rows({selected: true});
    let rows_data = rows.data();
    if (rows.count() < 1) {
        show_alert('No rows selected!');
        return;
    }
    let message = 'Revert scan timestamp of %d row(s)? (Reverting a walk-in scan will delete that record)';
    show_confirmation(sprintf(message, rows.count())).then(function (result) {
        if (! result)
            return;
        let promises = [];
        for (let i = 0; i < rows.count(); i++) {
            let id = rows_data[i][0];   //First column of row = ID
            promises.push(datastore.getItem(id).then(function (item) {
                if (item.walk_in) {
                    promises.push(datastore.removeItem(id));
                } else {
                    item.scan_timestamp = null;
                    promises.push(datastore.setItem(id, item));
                }
            }));
        }
        Promise.all(promises).then(function () {
            refresh_data();
            update_table_editing_buttons();
        }).catch(function (e) { 
            handle_error('Could not read/write local storage', e);
        });
    });
}

function update_table_editing_buttons() {
    if (datatable.rows({ selected: true }).count() < 1) {
        $('#delete-record-btn, #delete-scan-btn').addClass('disabled');
    } else {
        $('#delete-record-btn, #delete-scan-btn').removeClass('disabled');
    }
}

function loading_indicator(visible) {
    if (visible) {
        $('#loading-indicator').removeClass('hidden');
    } else {
        $('#loading-indicator').addClass('hidden');
    }
}

function handle_error(message, e='') {
    show_alert(message + ' ' + e);
    console.exception(message, e);
}

function show_alert(message) {
    return new Promise(function(resolve, reject) { 
        bootbox.alert(message, resolve);
    });
}

function show_confirmation(message) {
    return new Promise(function(resolve, reject) { 
        bootbox.confirm(message, resolve);
    });
}