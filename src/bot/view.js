var globals = require('./globals/globals');
var config = require('./globals/config');
var storageManager = require('storageManager');
var blockly = require('blockly');
var i18n = require('i18n');
var appId = require('appId');
var activeTutorial = null;
var tours = {}; // e
var botUtils = require('./utils/utils');
var commonUtils = require('utils');
var fileSaver = require('filesaverjs');
require('./utils/draggable');

var initTours = function initTours() {
	tours.introduction = require('./tours/introduction');
	tours.welcome = require('./tours/welcome');
	tours.welcome.welcome();
};

var uiComponents = {
	tutorialList: '.tutorialList',
	logout: '.logout',
	workspace_inside: 'svg > .blocklyWorkspace > .blocklyBlockCanvas',
	workspace: '.blocklyWorkspace',
	toolbox: '.blocklyToolboxDiv',
	file_management: '.intro-file-management',
	token: '.intro-token',
	run_stop: '.intro-run-stop',
	trash: '.blocklyTrash',
	undo_redo: '.intro-undo-redo',
	summary: '.intro-summary',
	center: '#center',
	flyout: '.blocklyFlyoutBackground',
	submarket: ".blocklyDraggable:contains('Submarket'):last",
	strategy: ".blocklyDraggable:contains('Strategy'):last",
	finish: ".blocklyDraggable:contains('Finish'):last",
};

var doNotHide = ['center', 'flyout', 'workspace_inside', 'trash', 'submarket', 'strategy', 'finish'];

var getUiComponent = function getUiComponent(component) {
	return $(uiComponents[component]);
};

var startTutorial = function startTutorial(e) {
	if (e) {
		e.preventDefault();
	}
	if (activeTutorial) {
		activeTutorial.stop();
	}
	activeTutorial = tours[$('#tours')
		.val()];
	activeTutorial.start();
	$('#tutorialButton')
		.unbind('click', startTutorial);
	$('#tutorialButton')
		.bind('click', stopTutorial);
	$('#tutorialButton')
		.text(i18n._('Stop!'));
};

var stopTutorial = function stopTutorial(e) {
	if (e) {
		e.preventDefault();
	}
	if (activeTutorial) {
		if (e) {
			activeTutorial.stop();
		}
		activeTutorial = null;
	}
	$('#tutorialButton')
		.unbind('click', stopTutorial);
	$('#tutorialButton')
		.bind('click', startTutorial);
	$('#tutorialButton')
		.text(i18n._('Go!'));
};

var setOpacityForAll = function setOpacityForAll(enabled, opacity) {
	if (enabled) {
		Object.keys(uiComponents)
			.forEach(function (key) {
				if (doNotHide.indexOf(key) < 0) {
					getUiComponent(key)
						.css('opacity', opacity);
					var disabled = +opacity < 1;
					getUiComponent(key)
						.find('button')
						.prop('disabled', disabled);
					getUiComponent(key)
						.find('input')
						.prop('disabled', disabled);
					getUiComponent(key)
						.find('select')
						.prop('disabled', disabled);
				}
			});
	}
};

var setOpacity = function setOpacity(enabled, componentName, opacity) {
	if (enabled) {
		getUiComponent(componentName)
			.css('opacity', opacity);
		var disabled = +opacity < 1;
		getUiComponent(componentName)
			.find('button')
			.prop('disabled', disabled);
		getUiComponent(componentName)
			.find('input')
			.prop('disabled', disabled);
		getUiComponent(componentName)
			.find('select')
			.prop('disabled', disabled);
	}
};

var saveXml = function saveXml(showOnly) {
	var xmlDom = blockly.Xml.workspaceToDom(blockly.mainWorkspace);
	Array.prototype.slice.apply(xmlDom.getElementsByTagName('field'))
		.forEach(function (field) {
			if (field.getAttribute('name') === 'ACCOUNT_LIST') {
				if (field.childNodes.length >= 1) {
					field.childNodes[0].nodeValue = '';
				}
			}
		});
	Array.prototype.slice.apply(xmlDom.getElementsByTagName('block'))
		.forEach(function (block) {
			switch (block.getAttribute('type')) {
			case 'trade':
				block.setAttribute('id', 'trade');
				break;
			case 'on_strategy':
				block.setAttribute('id', 'strategy');
				break;
			case 'on_finish':
				block.setAttribute('id', 'finish');
				break;
			default:
				block.removeAttribute('id');
				break;
			}
		});
	var xmlText = blockly.Xml.domToPrettyText(xmlDom);
	if (showOnly) {
		botUtils.log(xmlText);
	} else {
		var filename = 'binary-bot' + parseInt(new Date()
			.getTime() / 1000) + '.xml';
		var blob = new Blob([xmlText], {
			type: 'text/xml;charset=utf-8'
		});
		fileSaver.saveAs(blob, filename);
	}
};

var run = function run() {
	// Generate JavaScript code and run it.
	try {
		window.LoopTrap = 1000;
		blockly.JavaScript.INFINITE_LOOP_TRAP =
			'if (--window.LoopTrap == 0) throw "Infinite loop.";\n';
		var code = blockly.JavaScript.workspaceToCode(blockly.mainWorkspace);
		blockly.JavaScript.INFINITE_LOOP_TRAP = null;
		var EVAL_BLOCKLY_CODE = eval;
		EVAL_BLOCKLY_CODE(code);
		$('#stopButton')
			.text('Stop');
		$('#runButton')
			.text('Restart');
		$('#summaryPanel')
			.show();
		$('#stopButton')
			.unbind('click', reset);
		$('#stopButton')
			.bind('click', stop);
	} catch (e) {
		botUtils.showError(e);
	}
};

$.get('xml/toolbox.xml', function (toolbox) {
	require('./code_generators/index');
	require('./definitions/index');
	var workspace = blockly.inject('blocklyDiv', {
		media: 'js/blockly/media/',
		toolbox: i18n.xml(toolbox.getElementsByTagName('xml')[0]),
		zoom: {
			controls: true,
			wheel: false,
			startScale: 1.0,
			maxScale: 3,
			minScale: 0.3,
			scaleSpeed: 1.2
		},
		trashcan: true,
	});
	$.get('xml/main.xml', function (main) {
		blockly.Xml.domToWorkspace(main.getElementsByTagName('xml')[0], workspace);
		blockly.mainWorkspace.getBlockById('trade')
			.setDeletable(false);
		blockly.mainWorkspace.getBlockById('strategy')
			.setDeletable(false);
		blockly.mainWorkspace.getBlockById('finish')
			.setDeletable(false);
		botUtils.updateTokenList();
		botUtils.addPurchaseOptions();
		blockly.mainWorkspace.clearUndo();
		initTours();
	});
});

var handleFileSelect = function handleFileSelect(e) {
	var files;
	if (e.type === 'drop') {
		e.stopPropagation();
		e.preventDefault();
		files = e.dataTransfer.files;
	} else {
		files = e.target.files;
	}
	files = Array.prototype.slice.apply(files);
	var file = files[0];
	if (file) {
		if (file.type.match('text/xml')) {
			readFile(file);
		} else {
			botUtils.log(i18n._('File is not supported:' + ' ') + file.name, 'info');
		}
	}
};

var readFile = function readFile(f) {
	reader = new FileReader();
	reader.onload = (function (theFile) {
		return function (e) {
			try {
				blockly.mainWorkspace.clear();
				var xml = blockly.Xml.textToDom(e.target.result);
				blockly.Xml.domToWorkspace(xml, blockly.mainWorkspace);
				botUtils.addPurchaseOptions();
				var tokenList = storageManager.getTokenList();
				if (tokenList.length !== 0) {
					blockly.mainWorkspace.getBlockById('trade')
						.getField('ACCOUNT_LIST')
						.setValue(tokenList[0].token);
					blockly.mainWorkspace.getBlockById('trade')
						.getField('ACCOUNT_LIST')
						.setText(tokenList[0].account_name);
				}
				blockly.mainWorkspace.clearUndo();
				blockly.mainWorkspace.zoomToFit();
				botUtils.log(i18n._('Blocks are loaded successfully'), 'success');
			} catch (err) {
				botUtils.showError(err);
			}
		};
	})(f);
	reader.readAsText(f);
};

var handleDragOver = function handleDragOver(e) {
	e.stopPropagation();
	e.preventDefault();
	e.dataTransfer.dropEffect = 'copy';
};

var dropZone = document.getElementById('drop_zone');

dropZone.addEventListener('dragover', handleDragOver, false);
dropZone.addEventListener('drop', handleFileSelect, false);
document.getElementById('files')
	.addEventListener('change', handleFileSelect, false);

var reset = function reset(e) {
	if (e) {
		e.preventDefault();
	}
	globals.resetTradeInfo();
	botUtils.log(i18n._('Reset successful'), 'success');
};

var stop = function stop(e) {
	if (e) {
		e.preventDefault();
	}
	var trade = require('./trade/trade');
	trade.stop();
	globals.disableRun(false);
	$('#stopButton')
		.text(i18n._('Reset'));
	$('#runButton')
		.text(i18n._('Run'));
	$('#stopButton')
		.unbind('click', stop);
	$('#stopButton')
		.bind('click', reset);
};

$('#tutorialButton')
	.bind('click', startTutorial);
$('#stopButton')
	.text(i18n._('Reset'));
$('#stopButton')
	.bind('click', reset);

$('#summaryPanel .exitPanel')
	.click(function () {
		$(this)
			.parent()
			.hide();
	});

$('#summaryPanel')
	.hide();

$('#summaryPanel')
	.drags();

$('#chart')
	.mousedown(function (e) { // prevent chart to trigger draggable
		e.stopPropagation();
	});

$('table')
	.mousedown(function (e) { // prevent tables to trigger draggable
		e.stopPropagation();
	});

globals.showTradeInfo();
$('#saveXml')
	.click(function (e) {
		saveXml();
	});

$('#undo')
	.click(function (e) {
		globals.undoBlocks();
	});

$('#redo')
	.click(function (e) {
		globals.redoBlocks();
	});

$('#showSummary')
	.click(function (e) {
		$('#summaryPanel')
			.show();
	});

$('#run')
	.click(function (e) {
		run();
	});

$('#logout')
	.click(function (e) {
		botUtils.logout();
	});

$('#runButton')
	.click(function (e) {
		run();
	});


module.exports = {
	uiComponents: uiComponents,
	getUiComponent: getUiComponent,
	setOpacityForAll: setOpacityForAll,
	setOpacity: setOpacity,
	stopTutorial: stopTutorial,
	startTutorial: startTutorial,
	initTours: initTours,
};