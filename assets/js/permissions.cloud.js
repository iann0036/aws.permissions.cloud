// permissions.cloud Core Functionality

async function getTemplates(action, iam_def) {
    let action_parts = action.split(":");
    let ret = '*';
    let templates = [];

    for (let service_def of iam_def) {
        if (service_def['prefix'] == action_parts[0]) {
            for (let privilege of service_def['privileges']) {
                if (privilege['privilege'] == action_parts[1]) {
                    for (let resource_type of privilege['resource_types']) {
                        if (resource_type['resource_type'] != "") {
                            resource_type_name = resource_type['resource_type'].replace("*", "");
                            for (let resource of service_def['resources']) {
                                if (resource['resource'] == resource_type_name) {
                                    let arn = resource['arn'];

                                    arn = arn.replace(/\$\{(Partition)\}/g, '<span class="badge badge-pill badge-secondary">aws</span>');
                                    arn = arn.replace(/\$\{(Region)\}/g, '<span class="badge badge-pill badge-secondary">us-east-1</span>');
                                    arn = arn.replace(/\$\{(Account)\}/g, '<span class="badge badge-pill badge-secondary">123456789012</span>');
                                    arn = arn.replace(/\$\{(.+?)\}/g, '<span class="badge badge-pill badge-info">$1</span>');

                                    templates.push(arn);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (templates.length) {
        ret = templates.join("<br />");
    }

    return ret;
}

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
            } else if (window.location.pathname == "/api/" + service_def['prefix']) {
                service = service_def;

                $('#reference-list').append('<li class="nav-item active"><a href="/api/' + service_def['prefix'] + '" class="nav-link"><span>' + service_def['service_name'] + '</span></a></li>');
            } else if (window.location.pathname.startsWith("/api/")) {
                $('#reference-list').append('<li class="nav-item"><a href="/api/' + service_def['prefix'] + '" class="nav-link"><span>' + service_def['service_name'] + '</span></a></li>');
            } else {
                $('#reference-list').append('<li class="nav-item"><a href="/iam/' + service_def['prefix'] + '" class="nav-link"><span>' + service_def['service_name'] + '</span></a></li>');
            }
        }
    }

    if (window.location.pathname == "/") {
        $('#nav-general-dashboard').addClass('active');
    } else if (window.location.pathname.startsWith("/usingawsiam")) {
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

    $('.servicename').html(service['service_name']);
    $('#iam-count').html(service['privileges'].length);

    $('.iam-link').click(() => {
        window.location.pathname = window.location.pathname.replace("/api/", "/iam/");
    });
    $('.api-link').click(() => {
        window.location.pathname = window.location.pathname.replace("/iam/", "/api/");
    });

    let actions_table_content = '';
    for (let privilege of service['privileges']) {
        let first_resource_type = privilege['resource_types'].shift();

        let condition_keys = [];
        for (let condition_key of first_resource_type['condition_keys']) {
            condition_keys.push('<a href="#">' + condition_key + '</a>');
        }

        let rowspan = privilege['resource_types'].length + 1;
        let access_class = "tx-success";
        if (["Write", "Permissions management"].includes(privilege['access_level'])) {
            access_class = "tx-pink";
        }

        let used_by = '-';

        actions_table_content += '<tr>\
            <td rowspan="' + rowspan + '" class="tx-medium"><span class="tx-color-03">' + service['prefix'] + ':</span>' + privilege['privilege'] + '</td>\
            <td rowspan="' + rowspan + '" class="tx-normal">' + privilege['description'] + '</td>\
            <td rowspan="' + rowspan + '" class="tx-normal">' + used_by + '</td>\
            <td rowspan="' + rowspan + '" class="' + access_class + '">' + privilege['access_level'] + '</td>\
            <td class="tx-normal">' + first_resource_type['resource_type'] + '</td>\
            <td class="tx-medium">' + condition_keys.join("<br />") + '</td>\
        </tr>';

        for (let resource_type of privilege['resource_types']) {
            let condition_keys = [];
            for (let condition_key of resource_type['condition_keys']) {
                condition_keys.push('<a href="#">' + condition_key + '</a>');
            }

            actions_table_content += '<tr>\
                <td class="tx-normal" style="padding-left: 10px !important;">' + resource_type['resource_type'] + '</td>\
                <td class="tx-medium">' + condition_keys.join("<br />") + '</td>\
            </tr>';
        }
    }
    $('#actions-table tbody').append(actions_table_content);

    let sdk_map_data = await fetch('/map.json');
    let sdk_map = await sdk_map_data.json();

    // get primary
    let api_prefix = '';
    for (let iam_mapping_name of Object.keys(sdk_map['sdk_method_iam_mappings'])) {
        let first_action = sdk_map['sdk_method_iam_mappings'][iam_mapping_name][0];

        if (first_action['action'].split(":")[0] == service['prefix']) {
            api_prefix = iam_mapping_name.split(".")[0];
        }
    }

    let method_table_content = '';
    let api_count = 0;
    for (let iam_mapping_name of Object.keys(sdk_map['sdk_method_iam_mappings'])) {
        let iam_mapping_name_parts = iam_mapping_name.split(".");
        if (iam_mapping_name_parts[0] == api_prefix) {
            let first_action = sdk_map['sdk_method_iam_mappings'][iam_mapping_name].shift();

            let rowspan = sdk_map['sdk_method_iam_mappings'][iam_mapping_name].length + 1;

            let actionlink = "/iam/" + first_action['action'].split(":")[0];
            let template = await getTemplates(first_action['action'], iam_def);

            method_table_content += '<tr>\
                <td rowspan="' + rowspan + '" class="tx-medium"><span class="tx-color-03">' + iam_mapping_name_parts[0] + '.</span>' + iam_mapping_name_parts[1] + '</td>\
                <td rowspan="' + rowspan + '" class="tx-normal">' + '-' + '</td>\
                <td class="tx-medium"><a href="' + actionlink + '">' + first_action['action'] + '</a></td>\
                <td class="tx-medium">' + template + '</td>\
            </tr>';

            for (let action of sdk_map['sdk_method_iam_mappings'][iam_mapping_name]) {
                let actionlink = "/iam/" + action['action'].split(":")[0];
                let template = await getTemplates(action['action'], iam_def);

                method_table_content += '<tr>\
                    <td class="tx-medium" style="padding-left: 10px !important;"><a href="' + actionlink + '">' + action['action'] + '</a></td>\
                    <td class="tx-medium">' + template + '</td>\
                </tr>';
            }

            api_count += 1;
        }
    }

    $('#api-count').html(api_count);
    $('#methods-table tbody').append(method_table_content);
}

preprocess();
