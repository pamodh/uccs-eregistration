$(document).ready(function() {
    $('#qr-reader').html5_qrcode(function(data){
            alert('Code read: ' + data);
        }, function(error){
            $('#qr-status').html(error);
        }, function(videoError){
            alert('Error opening: ' + videoError);
        });
});

function code_scanned(code) {

}