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
    $('#qr-change-camera-btn').click(function () { activate_camera(active_camera + 1); });

    $('#manual-start-btn').click(init_manual_entry);
    $('#manual-stop-btn').click(stop_manual_entry);
    $('#manual-entry-form').submit(function (event) {
        code_scanned($('#manual-text-input').val());
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
    datatable.on('select deselect', update_selection_buttons);
    refresh_data();
});

function init_manual_entry() {
    stop_scanner();
    $('#qr-start-panel').addClass('hidden');
    $('#manual-entry-panel').removeClass('hidden');
    $('#manual-text-input').select();
}

function stop_manual_entry() {
    $('#qr-start-panel').removeClass('hidden');
    $('#manual-entry-panel').addClass('hidden');
}

function init_scanner() {
    scanner = new Instascan.Scanner({ video: document.getElementById('qr-preview'), mirror: camera_mirror });
    scanner.addListener('scan', function (content) {
        code_scanned(content);
        stop_scanner();
    });
    activate_camera(active_camera);
    $('#qr-start-panel').addClass('hidden');
    $('#qr-panel').removeClass('hidden');
}

function stop_scanner() {
    if (scanner != null) {
        scanner.stop().then(function () {
            $('#qr-start-panel').removeClass('hidden');
            $('#qr-panel').addClass('hidden');
        });
    }
}

function activate_camera(camera_num) {
    Instascan.Camera.getCameras().then(function (cameras) {
        if (cameras.length > 0) {
            if (active_camera < 0 || active_camera >= cameras.length)
                active_camera = 0;
            scanner.start(cameras[camera_num]).then(function() { active_camera = camera_num; });
            camera_num++;
        } else {
            handle_error('No cameras found on your device! Check permissions!');
        }
    }).catch(function (e) {
        handle_error('Error accessing camera! Check permissions!', e);
    });
}

function toggle_camera_mirror() {
    scanner.stop().then(function () {
        camera_mirror = ! camera_mirror;
        init_scanner();
    });
}

function code_scanned(code) {
    code = String(code).trim();
    if (! code.startsWith('UCCS/')) {
        show_alert('This does not look like an UCCS ID!');
        return;
    }
    datastore.getItem(code).then(function (record) {
        if (record == null) {
            show_confirmation('This person has not registered! Add anyway?').then(function (result) {
                if (! result)
                    return;
                record = {
                    id: code,
                    name: null,
                    registration_timestamp: null,
                    scan_timestamp: new Date(),
                    walk_in: true
                };
                datastore.setItem(code, record).then(function () {
                    refresh_data();
                }).catch(function (e) {
                    handle_error('Error storing data locally', e)
                });
            });
        } else if (record.scan_timestamp != null) {
            show_alert('Already scanned at ' + record.scan_timestamp.toLocaleString('en-GB'));
        } else {
            show_confirmation('Scan ' + code + '?').then(function (result) {
                if (! result)
                    return;
                record.scan_timestamp = new Date();
                datastore.setItem(code, record).then(function () {
                    refresh_data();
                }).catch(function (e) {
                    handle_error('Error storing data locally', e)
                });
            });
        }
    }).catch(function (e) {
        handle_error('Error accessing locally stored data', e);
    })
}

function refresh_data() {
    datatable.clear();
    $('#refresh-data-btn').addClass('hidden');

    datastore.iterate(function (record, id, i) {
        datatable.row.add([
            s.escapeHTML(record.id),
            s.escapeHTML(record.name == null ? '<Unknown>' : record.name),
            s.escapeHTML(record.walk_in == true ? '<Walk-in>' : new Date(record.registration_timestamp).toLocaleString('en-GB')),
            s.escapeHTML(record.scan_timestamp == null ? '' : new Date(record.scan_timestamp).toLocaleString('en-GB'))
        ]);
    }).then(function() {
        $('#refresh-data-btn').removeClass('hidden');
        datatable.draw();
    }).catch(function (e) {
        $('#refresh-data-btn').removeClass('hidden');
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
            update_selection_buttons();
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
    show_confirmation(sprintf('Revert scan timestamp of %d row(s)?', rows.count())).then(function (result) {
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
            update_selection_buttons();
        }).catch(function (e) { 
            handle_error('Could not read/write local storage', e);
        });
    });
}

function update_selection_buttons() {
    if (datatable.rows({ selected: true }).count() < 1) {
        $('#delete-record-btn, #delete-scan-btn').addClass('hidden');
    } else {
        $('#delete-record-btn, #delete-scan-btn').removeClass('hidden');
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