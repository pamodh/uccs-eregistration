$(document).ready(function() {
    $('#qr-reader').html5_qrcode(function(data){
            alert('Code read: ' + data);
        }, function(error){
            $('#qr-status').html(error);
        }, function(videoError){
            alert('Error opening: ' + videoError);
        });
    $('#qr-change-camera').click(function () {
        $('#qr-reader').html5_qrcode_changeCamera();
        $('#qr-status').html('Changed!');
    });
});

function code_scanned(code) {
    
}