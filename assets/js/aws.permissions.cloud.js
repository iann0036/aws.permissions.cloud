// permissions.cloud Core Functionality

var custom_policy_timer;

function escapeRegex(string) {
    return string.replace(/[\\^+()|]/g, '\\$&');
}

function arnReplace(arn, action, resource_mapping_sub, resource_type_name) {
    arn = escapeRegex(arn);

    if (action['resource_mappings'] && resource_mapping_sub) {
        if (resource_type_name && action['resourcearn_mappings']) {
            for (var resourcearn_mapping_name of Object.keys(action['resourcearn_mappings'])) {
                let template_replacement = templateReplace(action['resourcearn_mappings'][resourcearn_mapping_name], action, false);
                if (template_replacement == "*") {
                    arn = template_replacement;
                } else {
                    arn = '<a class="tx-semibold" href="#" data-toggle="modal" data-target="#resourceTypeModal">' + template_replacement + '</a>';
                }
            }
        }

        for (var resource_mapping_name of Object.keys(action['resource_mappings'])) {
            let template_replacement = templateReplace(action['resource_mappings'][resource_mapping_name]['template'], action, false);
            if (template_replacement == "*") {
                arn = arn.replace(new RegExp('\\$\\{(' + resource_mapping_name + ')\\}', 'g'), template_replacement);
            } else {
                arn = arn.replace(new RegExp('\\$\\{(' + resource_mapping_name + ')\\}', 'g'), '<a class="tx-semibold tx-pink" href="#" data-toggle="modal" data-target="#resourceTypeModal">' + template_replacement + '</a>');
            }
        }
    }

    arn = arn.replace(/\$\{(Partition)\}/g, '<span class="tx-semibold tx-gray-500">aws</span>');
    arn = arn.replace(/\$\{(Region)\}/g, '<span class="tx-semibold tx-gray-500">us-east-1</span>');
    arn = arn.replace(/\$\{(Account)\}/g, '<span class="tx-semibold tx-gray-500">123456789012</span>');
    
    arn = arn.replace(/\$\{(.+?)\}/g, '<a class="tx-semibold" href="#" data-toggle="modal" data-target="#resourceTypeModal">$1</a>');
    //arn = arn.replace(/\$\{(.+?)\}/g, '<span class="tx-semibold">$1</span>');

    return arn;
}

function shortDocs(method, docs) {
    if (!docs[method]) {
        return "-";
    }

    let ret = docs[method].replace(/<note>.+?<\/note>/gi, "").replace("</p>", " . ").replace(/(<([^>]+)>)/gi, "").split(". ")[0].trim();

    if (ret.substr(ret.length-1) != ".") {
        ret += ".";
    }

    return ret;
}

function templateReplace(arn, action, resource_mapping_sub) {
    if (arn.includes("%%iftruthy%")) {
        let arn_parts = arn.split("%");
        let else_ext = '';
        if (arn_parts[5] != "") {
            else_ext = ' <span class="badge badge-info">otherwise</span> ' + arnReplace(arn_parts[5], action, resource_mapping_sub, null);
        }

        return arnReplace(arn_parts[0], action, resource_mapping_sub, null) + '<span class="badge badge-info">if truthy</span> ' + arnReplace(arn_parts[3], action, resource_mapping_sub, null) + ' <span class="badge badge-info">then</span> ' + arnReplace(arn_parts[4], action, resource_mapping_sub, null) + else_ext;
    } else if (arn.includes("%%many%")) {
        let arn_parts = arn.split("%");
        let many_instances = [];
        for (let i=3; i<arn_parts.length-2; i++) {
            many_instances.push(arnReplace(arn_parts[i], action, resource_mapping_sub, null));
        }

        many_instances = [...new Set(many_instances)]; // dedupe

        return arnReplace(arn_parts[0], action, resource_mapping_sub, null) + many_instances.join("<br />");
    } else if (arn.includes("%%urlencode%")) {
        let arn_parts = arn.split("%");

        return arnReplace(arn_parts[0], action, resource_mapping_sub, null) + '<span class="badge badge-info">urlencode</span> ' + arnReplace(arn_parts[3], action, resource_mapping_sub, null);
    } else if (arn.includes("%%iftemplatematch%")) {
        let arn_parts = arn.split("%");

        return arnReplace(arn_parts[0], action, resource_mapping_sub, null) + '<span class="badge badge-info">if ARN matches format</span> ' + arnReplace(arn_parts[3], action, resource_mapping_sub, null);
    } else if (arn.includes("%%regex%")) {
        let arn_parts = arn.split("%");

        return arnReplace(arn_parts[0], action, resource_mapping_sub, null) + '<span class="badge badge-info">for the property</span> ' + arnReplace(arn_parts[3], action, resource_mapping_sub, null) + ' <span class="badge badge-info">get first match of the regex pattern</span> ' + arn_parts[4];
    }

    return arnReplace(arn, action, resource_mapping_sub, null);
}

function getTemplates(action, iam_def) {
    let action_parts = action['action'].split(":");
    let ret = '*';
    let original_templates = [];
    let processed_templates = [];

    for (let service_def of iam_def) {
        if (service_def['prefix'] == action_parts[0]) {
            for (let privilege of service_def['privileges']) {
                if (privilege['privilege'] == action_parts[1]) {
                    for (let resource_type of privilege['resource_types']) {
                        if (resource_type['resource_type'] != "") {
                            resource_type_name = resource_type['resource_type'].replace("*", "");
                            for (let resource of service_def['resources']) {
                                if (resource['resource'] == resource_type_name) {
                                    let arn = arnReplace(resource['arn'], action, true, resource_type_name);

                                    if (action['arn_override']) {
                                        arn = templateReplace(action['arn_override']['template'], action, true) + ' <span class="badge badge-dark">overridden</span>';
                                    }
                                    original_templates.push(resource['arn']);
                                    processed_templates.push(arn);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (action['arn_override'] && original_templates.length == 0) {
        original_templates.push("*");
        processed_templates.push(templateReplace(action['arn_override']['template'], action, true) + " <span class=\"badge badge-dark\">overridden</span>");
    }

    if (original_templates.length) {
        original_templates = [...new Set(original_templates)]; // dedupe
        processed_templates = [...new Set(processed_templates)]; // dedupe

        ret = "<span class=\"original-arn-template\" style=\"display: none;\">" + original_templates.join("<br />") + "</span><span class=\"processed-arn-template\">" + processed_templates.join("<br />") + "</span>";
    }

    return ret;
}

let privilege_to_iam_mapping_name = null;
function getUsedBy(privilege, sdk_map) {
    if (privilege_to_iam_mapping_name === null) {
        privilege_to_iam_mapping_name = {}
        for (let iam_mapping_name of Object.keys(sdk_map['sdk_method_iam_mappings']).sort()) {
            for (let action of sdk_map['sdk_method_iam_mappings'][iam_mapping_name]) {
                if (privilege_to_iam_mapping_name[action['action']] == null) {
                    privilege_to_iam_mapping_name[action['action']] = [];
                }
                privilege_to_iam_mapping_name[action['action']].push(iam_mapping_name)
            }
        }
    }
    let used_by_methods = (privilege_to_iam_mapping_name[privilege] || []).map(iam_mapping_name => {
        return "<a href=\"/api/" + sdk_map['sdk_method_iam_mappings'][iam_mapping_name][0]['action'].split(":")[0] + "#" + iam_mapping_name.replace(".", "_") + "\">" + iam_mapping_name + "</a>";
    });

    if (used_by_methods.length) {
        used_by_methods = [...new Set(used_by_methods)]; // dedupe
        used_by_methods.sort();

        return used_by_methods.join("<br />");
    }

    return '-';
}

var arn_template_state = "Processed";
function swapARN() {
    $('#arn-template-state').html(arn_template_state);
    if (arn_template_state == "Processed") {
        $('.original-arn-template').attr('style', '');
        $('.processed-arn-template').attr('style', 'display: none;');
        arn_template_state = "Original";
    } else {
        $('.original-arn-template').attr('style', 'display: none;');
        $('.processed-arn-template').attr('style', '');
        arn_template_state = "Processed";
    }
}

function readable_date(str) {
    if (!str) {
        return "-";
    }

    const months = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December'
    ]
    let date = new Date(str);
    
    return '<span data-toggle="tooltip" data-placement="top" title="' + str + '">' + date.getDate() + ' ' + months[date.getMonth()] + ', ' + date.getFullYear() + '</span>';
}

function processManagedPolicy(policy_data, iam_def) {
    effective_policy_table_content = '';

    $('#managedpolicytags').html((policy_data['data_access'] ? ' <span class="badge badge-info">data access</span>' : '') + (policy_data['resource_exposure'] ? ' <span class="badge badge-info">resource exposure</span>' : '') + (policy_data['credentials_exposure'] ? ' <span class="badge badge-info">credentials exposure</span>' : '') + (policy_data['unknown_actions'].length ? ' <span class="badge badge-warning">unknown actions</span>' : '') + (policy_data['privesc'] ? ' <span class="badge badge-warning">possible privesc</span>' : '') + (policy_data['grantless'] ? ' <span class="badge badge-warning">grantless</span>' : '') + (policy_data['malformed'] ? ' <span class="badge badge-danger">malformed</span>' : '') + (policy_data['deprecated'] ? ' <span class="badge badge-danger">deprecated</span>' : '') + (policy_data['undocumented_actions'] ? ' <span class="badge badge-danger">undocumented actions</span>' : ''));
    $('#managedpolicyarn').html(policy_data['arn']);
    $('#managedpolicyversion').html(policy_data['version']);

    for (let unknown_action of policy_data['unknown_actions']) {
        effective_policy_table_content += '<tr>\
            <td class="tx-medium"><span class="badge badge-warning">unknown</span></td>\
            <td class="tx-medium">' + unknown_action['action'] + '</td>\
            <td class="tx-normal"><span class="badge badge-warning">unknown</span></td>\
        </tr>';
    }
    for (let effective_action of policy_data['effective_actions']) {
        let access_class = "tx-success";
        if (["Write", "Permissions management"].includes(effective_action['access_level'])) {
            access_class = "tx-pink";
        }
        if (["Unknown"].includes(effective_action['access_level'])) {
            access_class = "tx-color-03";
        }
        let effective_action_parts = effective_action['effective_action'].split(":");

        effective_policy_table_content += '<tr>\
            <td class="tx-medium"><span class="tx-color-03">' + effective_action_parts[0] + ':</span>' + effective_action_parts[1] + (effective_action['data_access'] ? ' <span class="badge badge-info">data access</span>' : '') + (effective_action['resource_exposure'] ? ' <span class="badge badge-info">resource exposure</span>' : '') + (effective_action['credentials_exposure'] ? ' <span class="badge badge-info">credentials exposure</span>' : '') + (effective_action['privesc'] ? ' <span class="badge badge-warning">possible privesc</span>' : '') + (effective_action['access_level'] == "Unknown" ? ' <span class="badge badge-danger">undocumented</span>' : '') + '</td>\
            <td class="tx-medium">' + effective_action['action'] + '</td>\
            <td class="tx-normal ' + access_class + '">' + effective_action['access_level'] + '</td>\
        </tr>';
    }

    $('#effectivepolicy-table tbody').append(effective_policy_table_content);
}

function processCustomPolicy(iam_def, tags) {
    effective_policy_table_content = '';

    try {
        policy_json = JSON.parse($('.custompolicy').val());

        var allactions = {}
        const actionToArnPattern = {}
        iam_def.forEach(service => {
            service['privileges'].forEach(privilege => {
                allactions[service['prefix'] + ":" + privilege['privilege']] = privilege['access_level']

                const resourceNameToArnPattern = {};
                service['resources'].forEach(res => {
                    resourceNameToArnPattern[res['resource']] = new RegExp(
                        escapeRegex(res['arn'])
                            // AWS Backup's recoveryPoint is the only one that has this pattern.
                            .replace("${Vendor}",service['prefix'])
                            .replace(/\*/g, "[^:]+")
                            .replace(/\$\{[^}]+}/g, "[^:/]+"), "i");
                });
                actionToArnPattern[service['prefix'] + ":" + privilege['privilege']] = privilege['resource_types']
                    .filter(rt => rt['resource_type'] !== "")
                    .map(rt => resourceNameToArnPattern[rt["resource_type"].replace("*", "")]);
            });
        });

        // parse policy
        if (!policy_json['Statement'] || !Array.isArray(policy_json['Statement'])) {
            throw "Invalid";
        }

        var effective_actions = []
        var unknown_actions = []

        policy_json['Statement'].forEach(statement => {
            let resources;
            if (typeof statement['Resource'] === "string") {
                resources = [statement['Resource']]
            } else if (Array.isArray(statement['Resource'])) {
                resources = statement['Resource'];
            } else {
                // No resource specified or invalid type
                resources = ["*"];
            }
            const noWildcard = !resources.includes("*");
            if (statement['Action'] && statement['Effect'] == "Allow") {
                if (!Array.isArray(statement['Action'])) {
                    statement['Action'] = [statement['Action']];
                }
                statement['Action'].forEach(action => {
                    var foundmatch = false;
                    var matchexpression = "^" + action.replace(/\*/g, ".*").replace(/\?/g, ".{1}") + "$";
                    Object.keys(allactions).forEach(potentialaction => {
                        var re = new RegExp(matchexpression.toLowerCase(), "i");
                        if (potentialaction.toLowerCase().match(re)) {
                            foundmatch = true;

                            const resourceArnPatterns = actionToArnPattern[potentialaction];
                            if (noWildcard && $('#custompolicy-considerarn').is(':checked')) {
                                if (resourceArnPatterns.every(pattern => resources.every(res => !pattern.test(res)))) {
                                    // Skip addition if all of ARN patterns do not match any of the given Resource pattern
                                    return;
                                }
                            }

                            var condition = null;
                            if (statement['Condition']) {
                                condition = statement['Condition'];
                            }

                            var privesc = false;
                            if (tags['iam_lower']['PrivEsc'].includes(potentialaction.toLowerCase())) {
                                privesc = true;
                            }
                            var resource_exposure = false;
                            if (tags['iam_lower']['ResourceExposure'].includes(potentialaction.toLowerCase())) {
                                resource_exposure = true;
                            }
                            var credentials_exposure = false;
                            if (tags['iam_lower']['CredentialExposure'].includes(potentialaction.toLowerCase())) {
                                credentials_exposure = true;
                            }
                            var data_access = false;
                            if (tags['iam_lower']['DataAccess'].includes(potentialaction.toLowerCase())) {
                                data_access = true;
                            }

                            effective_actions.push({
                                'action': action,
                                'effective_action': potentialaction,
                                'access_level': allactions[potentialaction],
                                'condition': condition,
                                'privesc': privesc,
                                'resource_exposure': resource_exposure,
                                'credentials_exposure': credentials_exposure,
                                'data_access': data_access
                            });
                        }
                    });
                    if (!foundmatch) {
                        var condition = null;
                        if (statement['Condition']) {
                            condition = statement['Condition'];
                        }

                        unknown_actions.push({
                            'action': action,
                            'condition': condition
                        });
                    }
                });
            } else if (statement['NotAction'] && statement['Effect'] == "Allow") {
                if (!Array.isArray(statement['NotAction'])) {
                    statement['NotAction'] = [statement['NotAction']];
                }
                Object.keys(allactions).forEach(potentialaction => {
                    var matched = false;
                    statement['NotAction'].forEach(action => {
                        var matchexpression = "^" + action.replace(/\*/g, ".*").replace(/\?/g, ".{1}") + "$";
                        var re = new RegExp(matchexpression.toLowerCase(), "i");
                        if (potentialaction.toLowerCase().match(re)) {
                            matched = true;
                        }
                    });
                    if (matched) {
                        return;
                    }
                    const resourceArnPatterns = actionToArnPattern[potentialaction];
                    if (noWildcard && $('#custompolicy-considerarn').is(':checked')) {
                        if (resourceArnPatterns.every(pattern => resources.every(res => !pattern.test(res)))) {
                            // Remove if all of ARN patterns do not match any of the given Resource pattern
                            return;
                        }
                    }

                    var condition = null;
                    if (statement['Condition']) {
                        condition = statement['Condition'];
                    }

                    var privesc = false;
                    if (tags['iam_lower']['PrivEsc'].includes(potentialaction.toLowerCase())) {
                        privesc = true;
                    }
                    var resource_exposure = false;
                    if (tags['iam_lower']['ResourceExposure'].includes(potentialaction.toLowerCase())) {
                        resource_exposure = true;
                    }
                    var credentials_exposure = false;
                    if (tags['iam_lower']['CredentialExposure'].includes(potentialaction.toLowerCase())) {
                        credentials_exposure = true;
                    }
                    var data_access = false;
                    if (tags['iam_lower']['DataAccess'].includes(potentialaction.toLowerCase())) {
                        data_access = true;
                    }

                    effective_actions.push({
                        'action': "NotAction",
                        'effective_action': potentialaction,
                        'access_level': allactions[potentialaction],
                        'condition': condition,
                        'privesc': privesc,
                        'resource_exposure': resource_exposure,
                        'credentials_exposure': credentials_exposure,
                        'data_access': data_access
                    });
                });
            }
        });

        policy_data = {
            'unknown_actions': unknown_actions,
            'effective_actions': effective_actions
        };

        // output
        for (let unknown_action of policy_data['unknown_actions']) {
            effective_policy_table_content += '<tr>\
                <td class="tx-medium"><span class="badge badge-warning">unknown</span></td>\
                <td class="tx-medium">' + unknown_action['action'] + '</td>\
                <td class="tx-normal"><span class="badge badge-warning">unknown</span></td>\
            </tr>';
        }
        for (let effective_action of policy_data['effective_actions']) {
            let access_class = "tx-success";
            if (["Write", "Permissions management"].includes(effective_action['access_level'])) {
                access_class = "tx-pink";
            }
            if (["Unknown"].includes(effective_action['access_level'])) {
                access_class = "tx-color-03";
            }
            let effective_action_parts = effective_action['effective_action'].split(":");

            effective_policy_table_content += '<tr>\
                <td class="tx-medium"><span class="tx-color-03">' + effective_action_parts[0] + ':</span>' + effective_action_parts[1] + (effective_action['data_access'] ? ' <span class="badge badge-info">data access</span>' : '') + (effective_action['resource_exposure'] ? ' <span class="badge badge-info">resource exposure</span>' : '') + (effective_action['credentials_exposure'] ? ' <span class="badge badge-info">credentials exposure</span>' : '') + (effective_action['privesc'] ? ' <span class="badge badge-warning">possible privesc</span>' : '') + (effective_action['access_level'] == "Unknown" ? ' <span class="badge badge-danger">undocumented</span>' : '') + '</td>\
                <td class="tx-medium">' + effective_action['action'] + '</td>\
                <td class="tx-normal ' + access_class + '">' + effective_action['access_level'] + '</td>\
            </tr>';
        }
    } catch(err) {
        // do nothing
    }

    $('#customeffectivepolicy-table tbody').html(effective_policy_table_content);
}

function addcomma(val) {
    return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

async function addDashboardData(iam_def, sdk_map) {
    if (window.location.pathname !== "/") return;

    let counts_data = await fetch('https://aws.permissions.cloud/iam-dataset/aws/historic_counts.json');
    let counts = await counts_data.json();

    let now = Math.round(new Date() / 1000);
    let compare_date = now - (390*24*60*60);

    let ds1 = [];
    let last_ds1 = counts['api'][0]['count'];
    let ds2 = [];
    let last_ds2 = counts['iam'][0]['count'];
    let i = 0;

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let ticks = [[0, '']];

    while (compare_date < now) {
        for (let api_item of counts['api']) {
            let ds1date = Math.round(new Date(api_item['date']) / 1000);
            if (ds1date > compare_date && ds1date < compare_date + 86400) {
                last_ds1 = api_item['count'];
            }
        }

        
        for (let iam_item of counts['iam']) {
            let ds2date = Math.round(new Date(iam_item['date']) / 1000);
            if (ds2date > compare_date && ds2date < compare_date + 86400) {
                last_ds2 = iam_item['count'];
            }
        }

        ds1.push([i, last_ds1]);
        ds2.push([i, last_ds2-last_ds1]);

        compare_date += 86400;
        i += 1;

        let compare_date_date = new Date(compare_date * 1000);
        if (compare_date_date.getDate()	== 1) {
            ticks.push([i, monthNames[compare_date_date.getMonth()]])
        }
    }

    try {
        var flot1 = $.plot('#flotChart', [{
            data: ds1,
            color: '#69b2f8'
        }, {
            data: ds2,
            color: '#d1e6fa'
        }], {
            series: {
                stack: 0,
                shadowSize: 0,
                lines: {
                    show: true,
                    lineWidth: 0,
                    fill: 1
                }
            },
            grid: {
                borderWidth: 0,
                aboveData: true
            },
            yaxis: {
                show: false,
                min: 9000,
                max: Math.max(ds1[ds1.length-1][1]*1.3, ds2[ds2.length-1][1]*1.3)
            },
            xaxis: {
                show: true,
                ticks: ticks,
                color: 'rgba(255,255,255,.2)'
            }
        });
    } catch (e) {
    }

    let access_level_counts = {
        'List': 0,
        'Read': 0,
        'Tagging': 0,
        'Write': 0,
        'Permissions management': 0,
        'Unknown': 0
    }
    let access_level_total = 0;

    for (let service of iam_def) {
        for (let priv of service['privileges']) {
            access_level_counts[priv['access_level']] += 1;
            access_level_total += 1;
        }
    }

    var datapie = {
        labels: ['List', 'Read', 'Tagging', 'Write', 'Permissions management', 'Unknown'],
        datasets: [{
            data: Object.values(access_level_counts),
            backgroundColor: ['#7ee5e5', '#7ebcff', '#ffe082', '#fdbd88', '#f77eb9', '#ededed']
        }]
    };

    $('#dashboard-list-count').html(addcomma(access_level_counts['List']));
    $('#dashboard-list-percent').html(Math.round(access_level_counts['List'] / access_level_total * 100).toString() + "%");
    $('#dashboard-read-count').html(addcomma(access_level_counts['Read']));
    $('#dashboard-read-percent').html(Math.round(access_level_counts['Read'] / access_level_total * 100).toString() + "%");
    $('#dashboard-tagging-count').html(addcomma(access_level_counts['Tagging']));
    $('#dashboard-tagging-percent').html(Math.round(access_level_counts['Tagging'] / access_level_total * 100).toString() + "%");
    $('#dashboard-write-count').html(addcomma(access_level_counts['Write']));
    $('#dashboard-write-percent').html(Math.round(access_level_counts['Write'] / access_level_total * 100).toString() + "%");
    $('#dashboard-permissionsmanagement-count').html(addcomma(access_level_counts['Permissions management']));
    $('#dashboard-permissionsmanagement-percent').html(Math.round(access_level_counts['Permissions management'] / access_level_total * 100).toString() + "%");
    $('#dashboard-unknown-count').html(addcomma(access_level_counts['Unknown']));
    $('#dashboard-unknown-percent').html(Math.round(access_level_counts['Unknown'] / access_level_total * 100).toString() + "%");

    $('#dashboard-iam-total').html(addcomma(access_level_total));
    $('#dashboard-api-total').html(addcomma(counts['api'][counts['api'].length-1]['count']));

    var optionpie = {
        maintainAspectRatio: false,
        responsive: true,
        legend: {
            display: false,
        },
        animation: {
            animateScale: true,
            animateRotate: true
        }
    };

    // For a pie chart
    var ctx2 = document.getElementById('chartDonut');
    var myDonutChart = new Chart(ctx2, {
        type: 'doughnut',
        data: datapie,
        options: optionpie
    });
}

function expand_resource_type(service, resource_type) {
    if (resource_type == "") {
        return "";
    }

    for (let res_type of service['resources']) {
        if (res_type['resource'] == resource_type.replace("*", "")) {
            if (resource_type.includes("*")) {
                return res_type['arn'] + ' <span class="badge badge-primary">required</span>';
            }
            return res_type['arn'];
        }
    }
}

function getQueryVariable(variable) {
    var params = new URLSearchParams(window.location.search);
    var value = params.get(variable);
    if (value !== null) return value;
    console.log('Query variable %s not found', variable);
}

async function processReferencePage() {
    const iam_def_data = await fetch('https://aws.permissions.cloud/iam-dataset/aws/iam_definition.json');
    var iam_def = await iam_def_data.json();
    const iam_def_duplicate = JSON.parse(JSON.stringify(iam_def));
    let service = iam_def[0];

    let sdk_map_data = await fetch('https://aws.permissions.cloud/iam-dataset/aws/map.json');
    let sdk_map = await sdk_map_data.json();

    let docs_data = await fetch('https://aws.permissions.cloud/iam-dataset/aws/docs.json');
    let docs = await docs_data.json();

    let tags_data = await fetch('https://aws.permissions.cloud/iam-dataset/aws/tags.json');
    let tags = await tags_data.json();

    const managedpolicies_data = await fetch('https://aws.permissions.cloud/iam-dataset/aws/managed_policies.json');
    const managedpolicies = await managedpolicies_data.json();
    for (const managedpolicy of managedpolicies['policies']) {
        // Enrich for search
        managedpolicy['effective_action_names'] = managedpolicy['effective_action_names'].map(a => {
            const fullpriv = a.toLowerCase();
            const [prefix, privilege] = fullpriv.split(":");
            return {
                fullpriv,
                prefix,
                privilege,
            }
        });
    }

    $('#actions-table tbody').html('');

    iam_def.sort((a, b) => a['service_name'].replace("Amazon ", "").replace("AWS ", "") < b['service_name'].replace("Amazon ", "").replace("AWS ", "") ? -1 : 1)
    
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

    function openSearchModal() {
        $('.navbar-search').addClass('visible');
        $('.backdrop').addClass('show');
        setTimeout(() => {
            $('.navbar-search-header > input').focus();
        }, 100);
    }

    // Search
    $('#search-nav').on('click', function(e){
        e.preventDefault();
        openSearchModal()
    });

    $(window).on('keydown', function(e) {
        // Slash without any special keys to open search modal
        if (e.keyCode === 191 && !e.shiftKey && !e.ctrlKey && !e.ctrlKey && !e.metaKey) {
            if (!$('.navbar-search').hasClass('visible')) {
                openSearchModal()
                e.preventDefault();
            }
        }
        // Escape without any special keys to close search modal
        if (e.keyCode === 27 && !e.shiftKey && !e.ctrlKey && !e.ctrlKey && !e.metaKey) {
            if ($('.navbar-search').hasClass('visible')) {
                $('.navbar-search').removeClass('visible');
                $('.backdrop').removeClass('show');
                e.preventDefault();
            }
        }
    })

    $('.navbar-search-header > input').on('input', function(e){
        let searchterm = $('.navbar-search-header > input').val().toLowerCase();

        // IAM
        let html = '';
        let results = [];
        for (let service of iam_def) {
            for (let privilege of service['privileges']) {
                let fullpriv = service['prefix'] + ":" + privilege['privilege'];
                if (service['prefix'].toLowerCase().startsWith(searchterm) || privilege['privilege'].toLowerCase().startsWith(searchterm) || fullpriv.toLowerCase().startsWith(searchterm)) {
                    results.push(fullpriv);
                }
                if (results.length >= 10) break;
            }
            if (results.length >= 10) break;
        }
        for (let i=0; i<results.length && i<10; i++) {
            html += `<li style=\"margin-left: 5px; margin-top: 5px;\"><a href=\"/iam/${results[i].split(":")[0]}#${results[i].replace(":", "-")}\">${results[i]}</a></li>`;
        };
        $('#search-iam-list').html(html);

        // API
        html = '';
        results = [];
        for (let iam_mapping_name of Object.keys(sdk_map['sdk_method_iam_mappings']).sort()) {
            let split_name = iam_mapping_name.split(".");
            if (split_name[0].toLowerCase().startsWith(searchterm) || split_name[1].toLowerCase().startsWith(searchterm) || iam_mapping_name.toLowerCase().startsWith(searchterm)) {
                results.push(iam_mapping_name);
            }
            if (results.length >= 10) break;
        }
        for (let i=0; i<results.length && i<10; i++) {
            html += `<li style=\"margin-left: 5px; margin-top: 5px;\"><a href=\"/api/${sdk_map['sdk_method_iam_mappings'][results[i]][0]['action'].split(":")[0]}#${results[i].replace(".", "_")}\">${results[i]}</a></li>`;
        };
        $('#search-api-list').html(html);

        // Managed Policies
        html = '';
        results = [];
        for (let managedpolicy of managedpolicies['policies']) {
            if (managedpolicy['name'].toLowerCase().includes(searchterm) || managedpolicy['effective_action_names'].some(a => a['fullpriv'].startsWith(searchterm) || a['prefix'].startsWith(searchterm) || a['privilege'].startsWith(searchterm))) {
                results.push(managedpolicy['name']);
            }
            if (results.length >= 10) break;
        }
        for (let i=0; i<results.length && i<10; i++) {
            html += `<li style=\"margin-left: 5px; margin-top: 5px;\"><a href=\"/managedpolicies/${results[i]}\">${results[i]}</a></li>`;
        };
        $('#search-managedpolicies-list').html(html);
    });

    // omnibox search
    if (window.location.search.includes('s=')) {
        $('.navbar-search').addClass('visible');
        $('.backdrop').addClass('show');
        setTimeout(() => {
            $('.navbar-search-header > input').focus();
            $('.navbar-search-header > input').val(getQueryVariable('s'));
            $('.navbar-search-header > input').trigger('input');
        }, 100);
    }

    // resource type modal
    $('#resourceTypeModal').on('show.bs.modal', function (e) {
        let offset = 1;
        let rtdstart = "{";
        let rtdend = "\n}";        
        let tokens = $(e.relatedTarget).html().split(/(\[\]|\.)/g);
        for (let token of tokens) {
            if (token == "[]") {
                rtdstart += "[\n" + "    ".repeat(offset + 1);
                rtdend = "\n" + "    ".repeat(offset) + "]" + rtdend;
                offset += 1;
            } else if (token == ".") {
                rtdstart += "{" + "    ".repeat(offset + 1);
                rtdend = "\n" + "    ".repeat(offset) + "}" + rtdend;
                offset += 1;
            } else if (token == "") {
                // nothing
            } else {
                rtdstart += "\n" + "    ".repeat(offset) + "\"" + token + "\": ";
            }
        }
        rtdstart += "\"VALUE\",\n" + "    ".repeat(offset) + "...";
        $('#resourceTypeDisplay').html(rtdstart + rtdend);
    });

    //
    $('#body-dashboard').attr('style', 'display: none;');
    $('#body-usage').attr('style', 'display: none;');
    $('#body-managedpolicies').attr('style', 'display: none;');
    $('#body-permissions').attr('style', 'display: none;');
    $('#body-bytag').attr('style', 'display: none;');
    $('#body-managedpolicy').attr('style', 'display: none;');
    $('#body-policyevaluator').attr('style', 'display: none;');
    if (window.location.pathname == "/") {
        $('#nav-general-dashboard').addClass('active');
        $('#body-dashboard').attr('style', '');
    } else if (window.location.pathname.startsWith("/usage")) {
        $('#nav-general-usage').addClass('active');
        $('#body-usage').attr('style', '');
    } else if (window.location.pathname.startsWith("/managedpolicies/")) {
        $('#nav-general-managedpolicy').addClass('active');
        $('#body-managedpolicy').attr('style', '');
    } else if (window.location.pathname.startsWith("/managedpolicies")) {
        $('#nav-general-managedpolicies').addClass('active');
        $('#body-managedpolicies').attr('style', '');
    } else if (window.location.pathname.startsWith("/policyevaluator")) {
        $('#nav-general-policyevaluator').addClass('active');
        $('#body-policyevaluator').attr('style', '');
    } else if (window.location.pathname.startsWith("/tag")) {
        $('#body-bytag').attr('style', '');
    } else if (window.location.pathname.startsWith("/iam") || window.location.pathname.startsWith("/api")) {
        $('#body-permissions').attr('style', '');
    } else {
        // TODO
    }

    if (window.location.pathname.startsWith("/iam/")) {
        $('.display-iam').attr('style', '');
        $('.display-api').attr('style', 'display: none;');
    } else if (window.location.pathname.startsWith("/api/")) {
        $('.display-iam').attr('style', 'display: none;');
        $('.display-api').attr('style', '');
    }

    $('.servicename').html(service['service_name']);
    $('.iam-count').html(service['privileges'].length);

    $('.iam-link').click(() => {
        window.location.pathname = window.location.pathname.replace("/api/", "/iam/");
    });
    $('.api-link').click(() => {
        window.location.pathname = window.location.pathname.replace("/iam/", "/api/");
    });

    if (window.location.pathname.startsWith("/iam/")) {
        let actions_table_content = '';
        for (let privilege of service['privileges']) {
            let first_resource_type = privilege['resource_types'].shift();

            let condition_keys = [];
            for (let condition_key of first_resource_type['condition_keys']) {
                condition_keys.push('<a href="/tag/' + condition_key + '">' + condition_key + '</a>');
            }

            let rowspan = privilege['resource_types'].length + 1;
            let access_class = "tx-success";
            if (["Write", "Permissions management"].includes(privilege['access_level'])) {
                access_class = "tx-pink";
            }
            if (["Unknown"].includes(privilege['access_level'])) {
                access_class = "tx-color-03";
            }

            let used_by = getUsedBy(service['prefix'] + ':' + privilege['privilege'], sdk_map);

            if (privilege['description'].substr(privilege['description'].length - 1) != "." && privilege['description'].length > 1) {
                privilege['description'] += ".";
            }

            actions_table_content += '<tr id="' + service['prefix'] + '-' + privilege['privilege'] + '">\
                <td rowspan="' + rowspan + '" class="tx-medium"><span class="tx-color-03">' + service['prefix'] + ':</span>' + privilege['privilege'] + (privilege['access_level'] == "Unknown" ? ' <span class="badge badge-danger">undocumented</span>' : '') + ' <button class="btn btn-xs btn-icon btn-copy" onclick="copyToClipboard(\'' + service['prefix'] + ':' + privilege['privilege'] + '\')"><i class="fas fa-copy"></i></button></td>\
                <td rowspan="' + rowspan + '" class="tx-normal">' + privilege['description'] + '</td>\
                <td rowspan="' + rowspan + '" class="tx-medium">' + used_by + '</td>\
                <td rowspan="' + rowspan + '" class="' + access_class + '">' + privilege['access_level'] + '</td>\
                <td class="tx-medium">' + expand_resource_type(service, first_resource_type['resource_type']) + '</td>\
                <td class="tx-medium">' + condition_keys.join("<br />") + '</td>\
            </tr>';

            for (let resource_type of privilege['resource_types']) {
                let condition_keys = [];
                for (let condition_key of resource_type['condition_keys']) {
                    condition_keys.push('<a href="/tag/' + condition_key + '">' + condition_key + '</a>');
                }

                actions_table_content += '<tr>\
                    <td class="tx-medium" style="padding-left: 10px !important;">' + expand_resource_type(service, resource_type['resource_type']) + '</td>\
                    <td class="tx-medium">' + condition_keys.join("<br />") + '</td>\
                </tr>';
            }
        }
        $('#actions-table tbody').append(actions_table_content);
    }

    // get primary
    let api_prefixes = new Set();
    for (let iam_mapping_name of Object.keys(sdk_map['sdk_method_iam_mappings']).sort()) {
        let first_action = sdk_map['sdk_method_iam_mappings'][iam_mapping_name][0];

        if (first_action['action'].split(":")[0] == service['prefix']) { // TODO: better matching
            api_prefixes.add(iam_mapping_name.split(".")[0]);
        }
    }
    let api_count = 0;
    for (let iam_mapping_name of Object.keys(sdk_map['sdk_method_iam_mappings']).sort()) {
        let iam_mapping_name_parts = iam_mapping_name.split(".");
        if (api_prefixes.has(iam_mapping_name_parts[0])) {
            api_count += 1;
        }
    }
    $('.api-count').html(api_count.toString());

    if (window.location.pathname.startsWith("/api/")) {
        let method_table_content = '';
        for (let iam_mapping_name of Object.keys(sdk_map['sdk_method_iam_mappings']).sort()) {
            let iam_mapping_name_parts = iam_mapping_name.split(".");
            if (api_prefixes.has(iam_mapping_name_parts[0])) {
                let first_action = sdk_map['sdk_method_iam_mappings'][iam_mapping_name][0];
                let other_actions =  sdk_map['sdk_method_iam_mappings'][iam_mapping_name].slice(1);

                let rowspan = other_actions.length + 1;

                let actionlink = "/iam/" + first_action['action'].split(":")[0] + "#" + first_action['action'].replace(":", "-");
                let template = getTemplates(first_action, iam_def_duplicate);
                let undocumented = '';
                if (first_action['undocumented']) {
                    undocumented = ' <span class="badge badge-danger">undocumented</span>';
                }

                let notice = '';
                if (first_action['notice']) {
                    notice = ' <span class="tx-primary" data-toggle="tooltip" data-placement="top" title="' + first_action['notice'] + '"><i class="fas fa-info-circle"></i></span>';
                }

                method_table_content += '<tr id="' + iam_mapping_name_parts[0] + '_' + iam_mapping_name_parts[1] + '">\
                    <td rowspan="' + rowspan + '" class="tx-medium"><span class="tx-color-03">' + iam_mapping_name_parts[0] + '.</span>' + iam_mapping_name_parts[1] + '</td>\
                    <td rowspan="' + rowspan + '" class="tx-normal">' + shortDocs(iam_mapping_name, docs) + '</td>\
                    <td class="tx-medium"><a href="' + actionlink + '">' + first_action['action'] + undocumented + '</a>' + notice + '</td>\
                    <td class="tx-medium">' + template + '</td>\
                </tr>';

                for (let action of other_actions) {
                    let actionlink = "/iam/" + action['action'].split(":")[0] + "#" + action['action'].replace(":", "-");
                    let template = getTemplates(action, iam_def_duplicate);
                    let undocumented = '';
                    if (action['undocumented']) {
                        undocumented = ' <span class="badge badge-danger">undocumented</span>';
                    }

                    let notice = '';
                    if (action['notice']) {
                        notice = ' <span class="tx-primary" data-toggle="tooltip" data-placement="top" title="' + action['notice'] + '"><i class="fas fa-info-circle"></i></span>';
                    }

                    method_table_content += '<tr>\
                        <td class="tx-medium" style="padding-left: 10px !important;"><a href="' + actionlink + '">' + action['action'] + undocumented + '</a>' + notice + '</td>\
                        <td class="tx-medium">' + template + '</td>\
                    </tr>';
                }
            }
        }
        $('#methods-table tbody').append(method_table_content);
    }

    // by tag
    if (window.location.pathname.startsWith("/tag")) {
        let tag = decodeURIComponent(window.location.pathname.replace(/\/tag\//g, ""));
        let bytag_actions_table_content = '';
        let bytag_iam_count = 0;

        $('.tagname').html(tag);

        for (let i=0; i<iam_def.length; i++) {
            for (let j=0; j<iam_def[i]['privileges'].length; j++) {
                let has_tag = false;
                for (let k=0; k<iam_def[i]['privileges'][j]['resource_types'].length; k++) {
                    if (iam_def[i]['privileges'][j]['resource_types'][k]['condition_keys'].includes(tag)) {
                        has_tag = true;
                    }
                }
                if (has_tag) {
                    let service = iam_def[i];
                    let privilege = iam_def[i]['privileges'][j];
                    
                    let first_resource_type = privilege['resource_types'].shift();

                    let condition_keys = [];
                    for (let condition_key of first_resource_type['condition_keys']) {
                        condition_keys.push('<a href="/tag/' + condition_key + '">' + condition_key + '</a>');
                    }

                    let rowspan = privilege['resource_types'].length + 1;
                    let access_class = "tx-success";
                    if (["Write", "Permissions management"].includes(privilege['access_level'])) {
                        access_class = "tx-pink";
                    }
                    if (["Unknown"].includes(privilege['access_level'])) {
                        access_class = "tx-color-03";
                    }

                    let used_by = getUsedBy(service['prefix'] + ':' + privilege['privilege'], sdk_map);

                    if (privilege['description'].substr(privilege['description'].length-1) != "." && privilege['description'].length > 1) {
                        privilege['description'] += ".";
                    }
                    
                    bytag_actions_table_content += '<tr id="' + service['prefix'] + '-' + privilege['privilege'] + '">\
                        <td rowspan="' + rowspan + '" class="tx-medium"><span class="tx-color-03">' + service['prefix'] + ':</span>' + privilege['privilege'] + (privilege['access_level'] == "Unknown" ? ' <span class="badge badge-danger">undocumented</span>' : '') + '</td>\
                        <td rowspan="' + rowspan + '" class="tx-normal">' + privilege['description'] + '</td>\
                        <td rowspan="' + rowspan + '" class="tx-medium">' + used_by + '</td>\
                        <td rowspan="' + rowspan + '" class="' + access_class + '">' + privilege['access_level'] + '</td>\
                        <td class="tx-medium">' + expand_resource_type(service, first_resource_type['resource_type']) + '</td>\
                        <td class="tx-medium">' + condition_keys.join("<br />") + '</td>\
                    </tr>';

                    for (let resource_type of privilege['resource_types']) {
                        let condition_keys = [];
                        for (let condition_key of resource_type['condition_keys']) {
                            condition_keys.push('<a href="/tag/' + condition_key + '">' + condition_key + '</a>');
                        }

                        bytag_actions_table_content += '<tr>\
                            <td class="tx-medium" style="padding-left: 10px !important;">' + expand_resource_type(service, resource_type['resource_type']) + '</td>\
                            <td class="tx-medium">' + condition_keys.join("<br />") + '</td>\
                        </tr>';
                    }

                    bytag_iam_count += 1;
                }
            }
        }

        $('#bytag-actions-table tbody').append(bytag_actions_table_content);
        $('.bytag-iam-count').html(bytag_iam_count);
    }

    // managed policies
    let managedpolicies_table_content = '';

    managedpolicies['policies'].sort(function(a, b) {
        if (a['name'] < b['name']) {
            return -1;
        }
        return 1;
    });

    let deprecated_policy_count = 0;
    for (let managedpolicy of managedpolicies['policies']) {
        if (managedpolicy['deprecated']) {
            deprecated_policy_count += 1;
        }

        for (let i=0; i<managedpolicy['access_levels'].length; i++) {
            let access_class = "tx-success";
            if (["Write", "Permissions management"].includes(managedpolicy['access_levels'][i])) {
                access_class = "tx-pink";
            }
            if (["Unknown"].includes(managedpolicy['access_levels'][i])) {
                access_class = "tx-color-03";
            }
            managedpolicy['access_levels'][i] = "<span class=\"" + access_class + "\">" + managedpolicy['access_levels'][i] + "</span>";
        }

        managedpolicies_table_content += '<tr>\
            <td class="tx-medium"><a href="/managedpolicies/' + managedpolicy['name'] + '">' + managedpolicy['name'] + "</a>" + (managedpolicy['data_access'] ? ' <span class="badge badge-info">data access</span>' : '') + (managedpolicy['resource_exposure'] ? ' <span class="badge badge-info">resource exposure</span>' : '') + (managedpolicy['credentials_exposure'] ? ' <span class="badge badge-info">credentials exposure</span>' : '') + (managedpolicy['unknown_actions'] ? ' <span class="badge badge-warning">unknown actions</span>' : '') + (managedpolicy['privesc'] ? ' <span class="badge badge-warning">possible privesc</span>' : '') + (managedpolicy['grantless'] ? ' <span class="badge badge-warning">grantless</span>' : '') + (managedpolicy['malformed'] ? ' <span class="badge badge-danger">malformed</span>' : '') + (managedpolicy['deprecated'] ? ' <span class="badge badge-danger">deprecated</span>' : '') + (managedpolicy['undocumented_actions'] ? ' <span class="badge badge-danger">undocumented actions</span>' : '') + '</td>\
            <td class="tx-normal">' + managedpolicy['access_levels'].join(", ") + '</td>\
            <td class="tx-normal">' + managedpolicy['version'] + '</td>\
            <td class="tx-normal" style="text-decoration-line: underline; text-decoration-style: dotted;">' + readable_date(managedpolicy['createdate']) + '</td>\
            <td class="tx-normal" style="text-decoration-line: underline; text-decoration-style: dotted;">' + readable_date(managedpolicy['updatedate']) + '</td>\
        </tr>';

        if (window.location.pathname.startsWith("/managedpolicies/") && managedpolicy['name'] == window.location.pathname.replace("/managedpolicies/", "")) {
            let policy = await fetch('https://aws.permissions.cloud/iam-dataset/aws/managedpolicies/' + managedpolicy['name'] + '.json');
            let policy_data = await policy.json();
            $('.managedpolicyraw').html(Prism.highlight(JSON.stringify(policy_data['document'], null, 4), Prism.languages.javascript, 'javascript'));
            $('.managedpolicyname').html(managedpolicy['name']);
            processManagedPolicy(policy_data, iam_def);
            $('#managedpolicy-json-link').attr('href', 'https://raw.githubusercontent.com/iann0036/iam-dataset/refs/heads/main/aws/managedpolicies/' + managedpolicy['name'] + '.json');
        }
    }

    $('#managedpolicies-table tbody').append(managedpolicies_table_content);

    $('.active-managedpolicies-count').html(managedpolicies['policies'].length - deprecated_policy_count);
    $('.deprecated-managedpolicies-count').html(deprecated_policy_count);

    $('[data-toggle="tooltip"]').tooltip();

    // scroll to hash
    if (window.location.hash != "") {
        try {
            $('.content-body').scrollTop($(window.location.hash).offset().top - $('.content-header').height() + 1);
        } catch (e) {}
    }

    // policy evaluator

    if (window.location.pathname.startsWith("/policyevaluator")) {
        $('.custompolicy').bind('input propertychange', function() {
            clearTimeout(custom_policy_timer);
            custom_policy_timer = setTimeout(function(){
                processCustomPolicy(iam_def, tags);
            }, 800);
        });

        $('#custompolicy-considerarn').change(function() {
            clearTimeout(custom_policy_timer);
            custom_policy_timer = setTimeout(function(){
                processCustomPolicy(iam_def, tags);
            }, 800);
        });
    }

    // dashboard
    addDashboardData(iam_def, sdk_map);

    $(() => {
        $(".table-responsive").floatingScroll();
    });    
}

processReferencePage();

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(function() {
        // Show success feedback
        const button = event.target.closest('.btn-copy');
        const originalIcon = button.innerHTML;
        button.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => {
            button.innerHTML = originalIcon;
        }, 1000);
    }).catch(function(err) {
        console.error('Failed to copy text: ', err);
    });
}
