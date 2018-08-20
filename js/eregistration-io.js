/* 
	Copyright (c) 2018 University of Colombo Clinical Society
	Faculty of Medicine, University of Colombo
*/

function import_data() {
    $('#import-file-panel').removeClass('hidden');
    $(document).off('change', '#import-file-input');
    $(document).on('change', '#import-file-input', function(evt) {
        let files = evt.target.files;
        if (files.length <= 0)
            return;
        Papa.parse(files[0], {
            complete: function (result) {
                let data = result.data;
                let headers = data.shift();
                data.forEach(function (item) {
                    let item_object = {};
                    for (var i = 0; i < headers.length; i++) {
                        item_object[headers[i]] = item[i];
                    }
                    datastore.setItem(item_object.id, item_object);
                });                
                $('#import-file-panel').addClass('hidden');
                refresh_data();
                show_alert('Data import complete!');
            }
        })
    });
}

function export_data() {
    $('#export-data-btn').addClass('hidden');
    let dataarray = new Array();
    datastore.iterate(function (record, id, i) {
        dataarray.push(record);
    }).then(function() {
        let csv = Papa.unparse(dataarray);
        simulate_download(csv, "registration_data.csv");
        $('#export-data-btn').removeClass('hidden');
    }).catch(function (e) {
        $('#export-data-btn').removeClass('hidden');
        handle_error('Could not read data from local storage', e);
    });
}

function simulate_download(data, filename) {
    //Adapted from https://stackoverflow.com/questions/14964035/how-to-export-javascript-array-info-to-csv-on-client-side
    //And from https://stackoverflow.com/questions/25547475/save-to-local-file-from-blob
    let blob = new Blob([data], { type: 'text/csv' });
    var blobURL = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.setAttribute('href', blobURL);
    link.setAttribute('download', filename);
    link.setAttribute('style', 'display:none');
    link.innerHTML= 'Click Here to download';
    document.body.appendChild(link); // Required for FF
    link.click();
    document.body.removeChild(link);
}