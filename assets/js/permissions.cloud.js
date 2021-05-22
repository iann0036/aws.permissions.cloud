async function preprocess() {
    let iam_def_data = await fetch('/iam_definition.json');
    let iam_def = await iam_def_data.json();
    let service = iam_def[0];

    $('#actions-table tbody').html('');
    
    if ($('#reference-list').html() == "") {
        for (let service_def of iam_def) {
            if (window.location.pathname == "/iam/" + service_def['prefix']) {
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

    if (window.location.pathname.startsWith("/iam/")) {
        $('.display-iam').attr('style', '');
        $('.display-api').attr('style', 'display: none;');
    } else if (window.location.pathname.startsWith("/api/")) {
        $('.display-iam').attr('style', 'display: none;');
        $('.display-api').attr('style', '');
    }

    $('.link-iam').on('click', () => {
        window.location.pathname = window.location.pathname.replace("/api/", "/iam/");
    });
    $('.link-api').on('click', () => {
        window.location.pathname = window.location.pathname.replace("/iam/", "/api/");
    });

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
                <td class="tx-pink" style="padding-left: 10px !important;">' + resource_type['resource_type'] + '</td>\
                <td class="tx-medium">' + condition_keys.join("<br />") + '</td>\
            </tr>');
        }
    }

    let sdk_map_data = await fetch('/map.json');
    let sdk_map = await sdk_map_data.json();

    for (let iam_mapping_name of Object.keys(sdk_map['sdk_method_iam_mappings'])) {
        let iam_mapping_name_parts = iam_mapping_name.split(".");
        let first_action = sdk_map['sdk_method_iam_mappings'][iam_mapping_name].shift();

        let rowspan = sdk_map['sdk_method_iam_mappings'][iam_mapping_name].length + 1;

        $('#methods-table tbody').append('<tr>\
            <td rowspan="' + rowspan + '" class="tx-medium"><span class="tx-color-03">' + iam_mapping_name_parts[0] + '.</span>' + iam_mapping_name_parts[1] + '</td>\
            <td rowspan="' + rowspan + '" class="tx-normal">' + '-' + '</td>\
            <td class="tx-pink">' + first_action['action'] + '</td>\
            <td class="tx-medium">' + '-' + '</td>\
        </tr>');

        for (let action of sdk_map['sdk_method_iam_mappings'][iam_mapping_name]) {
            $('#methods-table tbody').append('<tr>\
                <td class="tx-pink">' + action['action'] + '</td>\
                <td class="tx-medium">' + '-' + '</td>\
            </tr>');
        }
    }

    $('.servicename').html(service['service_name']);
    $('#iam-count').html(service['privileges'].length);
}

preprocess();
