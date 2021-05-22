async function preprocess() {
    let iam_def_data = await fetch('/iam_definition.json');
    let iam_def = await iam_def_data.json();
    let service = iam_def[0];

    $('#actions-table tbody').html('');
    
    if ($('#reference-list').html() == "") {
        for (let service_def of iam_def) {
            if (window.location.pathname.startsWith("/iam/" + service_def['prefix'])) {
                service = service_def;

                $('#reference-list').append('<li class="nav-item active"><a href="/iam/' + service_def['prefix'] + '" class="nav-link"><span>' + service_def['service_name'] + '</span></a></li>');
            } else {
                $('#reference-list').append('<li class="nav-item"><a href="/iam/' + service_def['prefix'] + '" class="nav-link"><span>' + service_def['service_name'] + '</span></a></li>');
            }
        }
    }

    if (window.location.pathname.startsWith("/usingawsiam")) {
        $('#nav-general-usingawsiam').addClass('active');
    } else if (window.location.pathname.startsWith("/privesc")) {
        $('#nav-general-privesc').addClass('active');
    } else if (window.location.pathname.startsWith("/tooling")) {
        $('#nav-general-tooling').addClass('active');
    }

    for (let privilege of service['privileges']) {
        let first_resource_type = privilege['resource_types'].shift();

        let condition_keys = [];
        for (let condition_key of first_resource_type['condition_keys']) {
            condition_keys.push('<a href="#">' + condition_key + '</a>');
        }

        let rowspan = privilege['resource_types'].length + 1;

        $('#actions-table tbody').append('<tr>\
            <td rowspan="' + rowspan + '" class="tx-medium"><span class="tx-color-03">' + service['prefix'] + ':</span>' + privilege['privilege'] + '</td>\
            <td rowspan="' + rowspan + '" class="tx-normal">' + privilege['description'] + '</td>\
            <td rowspan="' + rowspan + '" class="tx-success">' + privilege['access_level'] + '</td>\
            <td class="tx-pink">' + first_resource_type['resource_type'] + '</td>\
            <td class="tx-medium">' + condition_keys.join("<br />") + '</td>\
        </tr>');

        for (let resource_type of privilege['resource_types']) {
            let condition_keys = [];
            for (let condition_key of resource_type['condition_keys']) {
                condition_keys.push('<a href="#">' + condition_key + '</a>');
            }

            $('#actions-table tbody').append('<tr>\
                <td class="tx-pink" style="padding-left: 0px !important;">' + resource_type['resource_type'] + '</td>\
                <td class="tx-medium">' + condition_keys.join("<br />") + '</td>\
            </tr>');
        }
    }

    $('.servicename').html(service['service_name']);
    $('#iam-count').html(service['privileges'].length);
}

preprocess();
