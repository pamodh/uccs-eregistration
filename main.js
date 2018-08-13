$(document).ready(function() {
    // $('#qr-video').html5_qrcode(function(data){
    //         alert('Code read: ' + data);
    //     }, function(error){
    //         $('#qr-status').html(error);
    //     }, function(videoError){
    //         alert('Error opening: ' + videoError);
    //     });
    // $('#qr-change-camera').click(function () {
    //     $('#qr-reader').html5_qrcode_changeCamera();
    //     $('#qr-status').html('Changed!');
    // });

    let scanner = new Instascan.Scanner({ video: document.getElementById('qr-video') });
    scanner.addListener('scan', function (content) {
        $('#qr-status').html('Scanned: ' + content);
    });
    Instascan.Camera.getCameras().then(function (cameras) {
      if (cameras.length > 0) {
        scanner.start(cameras[0]);
      } else {
        alert('No cameras found.');
      }
    }).catch(function (e) {
        $('#qr-status').html('Error: ' + e);
    });
});

function code_scanned(code) {
    
}