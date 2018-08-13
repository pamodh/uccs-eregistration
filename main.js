var scanner = null;
var active_camera = 0;
var camera_mirror = true;
var datastore = null;

$(document).ready(function() {
    datastore = localforage.createInstance({ name: 'registered-members' });
    $('#qr-start-btn').click(init_scanner);
    $('#qr-mirror-camera-btn').click(toggle_camera_mirror);
    $('#refresh-data-btn').click(refresh_data);
    $('#save-data-btn').click(export_data);
    $('#load-data-btn').click(import_data);
    $('#reset-data-btn').click(function () { datastore.clear(); refresh_data(); });
    refresh_data();
});

function init_scanner() {
    scanner = new Instascan.Scanner({ video: document.getElementById('qr-preview'), mirror: camera_mirror });
    scanner.addListener('scan', function (content) {
        code_scanned(content);
        scanner.stop().then(function () {
            $('#qr-start-panel').removeClass('hidden');
            $('#qr-panel').addClass('hidden');
        });
    });
    active_camera--;
    toggle_camera();
    $('#qr-change-camera-btn').click(toggle_camera);
    $('#qr-start-panel').addClass('hidden');
    $('#qr-panel').removeClass('hidden');
}

function toggle_camera() {
    Instascan.Camera.getCameras().then(function (cameras) {
        if (cameras.length > 0) {
            active_camera++;
            if (active_camera < 0 || active_camera >= cameras.length)
                active_camera = 0;
            scanner.start(cameras[active_camera]);
        } else {
            handle_error('No cameras found on your device! Check permissions!');
        }
    }).catch(function (e) {
        handle_error('Error accessing camera! Check permissions!', e);
    });
}

function toggle_camera_mirror() {
    scanner.stop().then(function () {
        active_camera--;
        camera_mirror = ! camera_mirror;
        init_scanner();
    });
}

function code_scanned(code) {
    code = String(code);
    datastore.getItem(code).then(function (record) {
        if (record == null) {
            if (window.confirm('This person has not registered! Scan anyway?')) {
                record = {
                    id: code,
                    scantime: new Date(),
                    walk_in: true
                };
                datastore.setItem(code, record).then().catch(function (e) {
                    handle_error('Error storing data locally', e)
                });
            }
        } else if (record.scantime != null) {
            window.alert('Already scanned at ' + record.scantime);
        } else {
            if (window.confirm('Scan ' + code + '?')) {
                record.scantime = new Date();
                datastore.setItem(code, record).then(function () {
                    refresh_data();
                }).catch(function (e) {
                    handle_error('Error storing data locally', e)
                });
            }
        }
    }).catch(function (e) {
        handle_error('Error accessing locally stored data', e);
    })
}

function refresh_data() {
    $('#data-table').find('tbody').empty();
    $('#refresh-data-btn').addClass('hidden');
    datastore.iterate(function (record, id, i) {
        $('#data-table').find('tbody').append(sprintf(
            '<tr><td>%s</td><td>%s</td><td>%s</td><td>%s</td>',
            record.id,
            record.name,
            record.walk_in == true ? 'Walk-in' : record.register_time,
            record.scantime
        ));
    }).then(function() {
        $('#refresh-data-btn').removeClass('hidden');
    }).catch(function (e) {
        $('#refresh-data-btn').removeClass('hidden');
        handle_error('Could not read data from local storage', e);
    });
}

function handle_error(message, e='') {
    alert(message + ' ' + e);
}

