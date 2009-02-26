(function($){

var comments = {};
var root_comments = [];
var noshow_comments = [];
var pieces_comments = [];
var placeholder_comments = [];
var placeholder_no_update = {};
var abbrev_comments = {};
var read_comments = {};
var init_hiddens = [];
var fetch_comments = [];
var fetch_comments_pieces = {};
var update_comments = {};
var root_comments_hash = {};
var last_updated_comments = [];
var last_updated_comments_index = 0;
var reply_link_html = {};
var comments_started = 0;
var current_cid = 0;
var more_comments_num;
var behaviors = {
	'default': { ancestors: 'none', parent: 'none', children: 'none', descendants: 'none', siblings: 'none', sameauthor: 'none' },
	'focus': { ancestors: 'none', parent: 'none', children: 'prehidden', descendants: 'prehidden', siblings: 'none', sameauthor: 'none' },
	'collapse': { ancestors: 'none', parent: 'none', siblings: 'none', sameauthor: 'none', currentmessage: 'oneline', children: 'hidden', descendants: 'hidden'}
};
var displaymode = {};
var futuredisplaymode = {};
var prehiddendisplaymode = {};
var viewmodevalue = { full: 3, oneline: 2, hidden: 1};
var currents = { full: 0, oneline: 0, hidden: 0 };
var commentelements = {};
var thresh_totals = {
	"-1":{"-1":0,0:0,1:0,2:0,3:0,4:0,5:0,6:0},
	   0:{0:0,1:0,2:0,3:0,4:0,5:0,6:0},
	   1:{1:0,2:0,3:0,4:0,5:0,6:0},
	   2:{2:0,3:0,4:0,5:0,6:0},
	   3:{3:0,4:0,5:0,6:0},
	   4:{4:0,5:0,6:0},
	   5:{5:0,6:0},
	   6:{6:0}
};
var d2_keybindings_off = 0;
var d2_keybindings_disable = {};
var d2_reverse_shift = 0;
var d2_comment_order = 0; // 0 == score, 1 == chrono

var submitCountdowns = {};
var ajaxCommentsWaitQueue = [];
var boxStatusQueue = [];
var comment_body_reply = [];
var root_comment = 0;
var base_comment = 0; // for which "more" comments to fetch
var discussion_id = 0;

var user_is_subscriber = 0;
var user_is_admin = 0;
var user_is_anon = 0;
var user_uid = 0;

var no_lower_threshold = 0;
var user_threshold_save = 1;
var user_threshold = 0;
var user_highlightthresh = 0;
var user_threshold_orig = -9;
var user_highlightthresh_orig = -9;
var user_d2asp = 0;

var async_off = 0;
var loaded = 0;
var shift_down = 0;
var alt_down = 0;
var ctrl_down = 0;
var meta_down = 0;
var d2_seen = '';
var low_bandwidth = 0;

var adTimerSecsMax   = 15;
var adTimerClicksMax = 0;
var adTimerUrl       = '';

var agt = navigator.userAgent.toLowerCase();
var is_firefox = (agt.indexOf("firefox") != -1);

/********************/
/* thread functions */
/********************/
function updateComment(cid, mode) {
	var existingdiv = fetchEl('comment_' + cid);
	var placeholder = 0;
	if (existingdiv && mode != displaymode[cid]) {
		var doshort = 0;
		if (viewmodevalue[mode] >= viewmodevalue[displaymode[cid]]) {
			var cl = fetchEl('comment_link_' + cid);
			if (!cl) {
				fetch_comments.push(cid);
				doshort = 1;
				if (comments[cid]['points'] == -2) // -2 is special case for placeholder-hiddens
					placeholder = 1;
			} else if (viewmodevalue[mode] >= viewmodevalue['full']) {
				var cd = fetchEl('comment_otherdetails_' + cid);
				if (!cd.innerHTML) {
					var cs = fetchEl('comment_sub_' + cid);
					if (cs)
						cs.innerHTML = '<span class="commentload">Loading...</span>';
					fetch_comments.push(cid);
					fetch_comments_pieces[cid] = 1;
					doshort = 1;
				}
			}
		}
//		if (doshort)
		setShortSubject(cid, mode, cl);
		var new_class = existingdiv.className.replace(/full|hidden|oneline/, mode);
		if (new_class != existingdiv.className) {
			existingdiv.className = new_class;
			var parentdiv = fetchEl('tree_' + cid);
			parentdiv.className = parentdiv.className.replace(' contain', '');
			if (mode == 'full')
				parentdiv.className = parentdiv.className + ' contain';
		}
		if (adTimerUrl) {
			var addiv = fetchEl('comment_ad_' + cid);
			if (addiv) {
				if (mode == 'hidden')
					addiv.style.display = 'none';
				else
					addiv.style.display = 'block';
			}
		}
	}

	if (placeholder)
		placeholder_comments.push(cid);
	else
		currents[displaymode[cid]]--;
	currents[mode]++;
	displaymode[cid] = mode;

	return void(0);
}

function updateCommentTree(cid, threshold, lowestmode, skip_read) {
	setDefaultDisplayMode(cid);
	var comment = comments[cid];

	// skip the root comment, if it exists; leave it full
	if (threshold && cid != root_comment)
		futuredisplaymode[cid] = determineMode(cid, threshold, user_highlightthresh, lowestmode, skip_read);

	if (displaymode[cid] != futuredisplaymode[cid]) {
		updateDisplayMode(cid, futuredisplaymode[cid], 1);
		update_comments[cid] = futuredisplaymode[cid];
	}

	var kidhiddens = 0;
	if (comment && comment['kids'] && comment['kids'].length) {
		for (var kiddie = 0; kiddie < comment['kids'].length; kiddie++) {
			kidhiddens += updateCommentTree(comment['kids'][kiddie], threshold, lowestmode, skip_read);
		}
	}

	return kidHiddens(cid, kidhiddens);
}

function setFocusComment(cid, alone, no_ads) {
	if (!loaded)
		return false;

	var abscid = Math.abs(cid);
	setDefaultDisplayMode(abscid);
	if ((alone && alone == 2) || (!alone && viewmodevalue[displaymode[abscid]] == viewmodevalue['full']))
		cid = '-' + abscid;

	if (abscid == cid) { // expanding == selecting
		setCurrentComment(cid);
		if (!no_ads)
			inlineAdCheckTimer(cid, adTimerUrl, adTimerClicksMax, adTimerSecsMax);
	}


// this doesn't work
//	var statusdiv = $dom('comment_status_' + abscid);
//	statusdiv.innerHTML = 'Working ...';

//	doModifiers();
//	if (!user_is_admin) // XXX: for now, admins-only, for testing
//		mods = 1;

// 	if (!alone && mods) {
// 		if (mods == 1 || ((mods == 3) && (abscid == cid)) || ((mods == 4) && (abscid != cid))) {
// 			shift_down = 0;
// 			alt_down   = 0;
// 		} else if (mods == 2 || ((mods == 3) && (abscid != cid)) || ((mods == 4) && (abscid == cid))) {
// 			shift_down = 1;
// 			alt_down   = 0;
// 		} else if (mods == 5) {
// 			shift_down = 1;
// 			alt_down   = 1;
// 		}
// 	}
//
// 	if (shift_down && alt_down)
// 		alone = 1;
//
// 	resetModifiers();

	var was_hidden = 0;
	if (displaymode[abscid] == 'hidden' || prehiddendisplaymode[abscid] == 'hidden')
		was_hidden = 1;

	if (alone && alone == 1) {
		var thismode = abscid == cid ? 'full' : 'oneline';
		updateDisplayMode(abscid, thismode, 1);
	} else {
		refreshDisplayModes(cid);
	}
	updateCommentTree(abscid);
	finishCommentUpdates();

//	statusdiv.innerHTML = '';

	if (!commentIsInWindow(abscid, (cid != abscid)))
		scrollWindowTo(abscid);

	if (was_hidden)
		updateHiddens([abscid]);

	inlineAdInsert(inlineAdInsertId());

	return false;
}

function changeTHT(t_delta, ht_delta) {
	if (!t_delta && !ht_delta)
		return void(0);

	user_threshold       += t_delta;
	user_highlightthresh += ht_delta;
	// limit to between -1 and 6
	user_threshold       = Math.min(Math.max(user_threshold,       -1), 6);
	user_highlightthresh = Math.min(Math.max(user_highlightthresh, -1), 6);

	// T cannot be higher than HT; this also modifies delta
	if (user_threshold > user_highlightthresh)
		user_threshold = user_highlightthresh;

	changeThreshold(user_threshold + ''); // needs to be a string value
}

function changeHT(delta) {
	if (!delta)
		return void(0);

	user_highlightthresh += delta;
	// limit to between -1 and 6
	user_highlightthresh = Math.min(Math.max(user_highlightthresh, -1), 6);

	// T cannot be higher than HT; this also modifies delta
	if (user_threshold > user_highlightthresh)
		user_threshold = user_highlightthresh;

	changeThreshold(user_threshold + ''); // needs to be a string value
}

function changeT(delta, skip_ht, lowestmode) {
	if (!delta)
		return void(0);

	var threshold = user_threshold + delta;
	// limit to between -1 and 6
	threshold = Math.min(Math.max(threshold, -1), 6);

	// HT moves with T, but that is taken care of by changeThreshold()
	changeThreshold(threshold + '', skip_ht, lowestmode); // needs to be a string value
}

function changeThreshold(threshold, skip_ht, lowestmode) {
	var threshold_num = parseInt(threshold);
	var t_delta = threshold_num + (user_highlightthresh - user_threshold);
	user_threshold = threshold_num;
	if (skip_ht) { // don't move highlightthresh with thresh
		if (user_threshold > user_highlightthresh)
			user_highlightthresh = user_threshold;
	} else {
		user_highlightthresh = Math.min(Math.max(t_delta, -1), 6);
	}

	for (var root = 0; root < root_comments.length; root++) {
		updateCommentTree(root_comments[root], threshold, lowestmode, skip_ht);
	}
	finishCommentUpdates(1);

	savePrefs();

	return void(0);
}

// not currently used
function parseCommentBitmap(bitmap) {
	if (!bitmap)
		return;

	var lastcid = 0;
	var comments_hash = {};
	var temp = bitmap.split(',');

	for (var i = 0; i < temp.length; i++) {
		var thiscid = parseInt(temp[i]);
		thiscid = lastcid ? (lastcid + thiscid) : thiscid;
		comments_hash[thiscid] = 1;
		lastcid = thiscid;
	}

	return comments_hash;
}



/*******************************/
/* thread kid/hidden functions */
/*******************************/
function kidHiddens(cid, kidhiddens) {
	var hiddens_cid = fetchEl('hiddens_' + cid);
	if (! hiddens_cid) // race condition, probably: new comment added in between rendering, and JS data structure
		return 0;

	// silly workaround to hide noscript LI bullet
	var hidestring_cid = fetchEl('hidestring_' + cid);
	if (hidestring_cid)
		hidestring_cid.className = 'hide';

	// may not be changed yet, that's OK
	if (futuredisplaymode[cid] == 'hidden') {
		hiddens_cid.className = 'hide';
		if (comments[cid]['points'] == -2) // -2 is special case for placeholder-hiddens
			return kidhiddens;
		else
			return kidhiddens + 1;
	} else if (kidhiddens) {
		var kidstring = '<a href="#" onclick="D2.revealKids(' + cid + '); return false">' + kidhiddens;
		if (kidhiddens == 1) {
			kidstring += ' hidden comment</a>';
		} else {
			kidstring += ' hidden comments</a>';
		}
		hiddens_cid.innerHTML = kidstring;
		hiddens_cid.className = 'show';
	} else {
		hiddens_cid.className = 'hide';
	}

	return 0;
}

function revealKids(cid, not_top) {
	if (!loaded)
		return false;

	setDefaultDisplayMode(cid);
	var comment = comments[cid];
	var len = comment['kids'].length;

	if (len) {
		var only_one = 0;
		if (!not_top && len == 1)
			only_one = 1;

		for (var kiddie = 0; kiddie < len; kiddie++) {
			var kid = comment['kids'][kiddie];
			setDefaultDisplayMode(kid);
			if (comments[kid]['points'] == -2) { // -2 is special case for placeholder-hiddens
				revealKids(kid, 1); // 1 == not at the top level
				continue;
			}
			if (displaymode[kid] == 'hidden') {
				futuredisplaymode[kid] = only_one ? 'full' : 'oneline';
				updateDisplayMode(kid, futuredisplaymode[kid], 1);
				updateComment(kid, futuredisplaymode[kid]);
			}
		}
	}

	updateCommentTree(cid);
	finishCommentUpdates();

	return void(0);
}

// update textual hidden counts
function updateHiddens(cids) {
	if (!cids || !cids.length)
		return;

	var seen = {};
	// something wrong here, not always working -- pudge 2007-01-16
	OUTER: for (var i = 0; i < cids.length; i++) {
		var cid = cids[i];
		while (cid && comments[cid] && comments[cid]['pid']) {
			cid = comments[cid]['pid'];
			if (seen[cid])
				continue OUTER;
			seen[cid] = 1;
		}
		updateCommentTree(cid);
	}
}

function selectParent(cid, collapse) {
	if (!loaded || !cid)
		return false;

	var comment = comments[cid];
	if (comment && fetchEl('comment_' + cid)) {
		setFocusComment(cid, (collapse ? 2 : 1));
		return false;
	} else {
		return true; // follow link
	}
	return false;
}

function vertBarClick() {
	if (this && this.id) {
		var pid = this.id.match(/_(\d+)/);
		pid = pid[1];

		if (pid) {
			comments_started = 1;
			setCurrentComment(pid);
			return selectParent(pid, 2);
		}
	}
}

function setShortSubject(cid, mode, cl) {
	if (!cl)
		cl = fetchEl('comment_link_' + cid);

	// subject is there only if it is a "reply"
	// check pid to make sure parent is there at all ... check visibility too?
	if (cl && cl.innerHTML && comments[cid]['subject'] && comments[cid]['pid']) {
		setDefaultDisplayMode(comments[cid]['pid']);
		if (!mode)
			mode = displaymode[cid];
		if (mode == 'full' || (mode == 'oneline' && displaymode[comments[cid]['pid']] == 'hidden')) {
			cl.innerHTML = comments[cid]['subject'];
		} else if (mode == 'oneline') {
			cl.innerHTML = 'Re:';
		}
	}
}

// XXX this CANNOT be called without then adjusting the fetchEl stuff for
// Firefox (see ajaxFetchComments) ... we may make that into a separate
// call later, as it has to be properly called AFTER addComment calls are
// all done -- pudge
function addComment(cid, comment, html, front) {
	if (!loaded || !cid || !comment)
		return false;


	if (comments[cid]) {
		var tmpkids = comments[cid]['kids'];
		for (var i = 0; i < comment['kids'].length; i++) {
			tmpkids.push(comment['kids'][i]);
		}
		comments[cid] = comment;
		comments[cid]['kids'] = tmpkids;
	} else {
		comments[cid] = comment;
	}
	var pid = comment['pid'];

	if ($dom('tree_' + cid)) {
		if (pid) {
			var parent = comments[pid];
			var seen = 0;
			for (var i = 0; i < parent['kids'].length; i++) {
				if (parent['kids'][i] == cid)
					seen = 1;
			}
			if (!seen)
				parent['kids'].push(cid);
		} else {
			var seen = 0;
			for (var i = 0; i < root_comments.length; i++) {
				if (root_comments[i] == cid)
					seen = 1;
			}
			if (!seen) {
				root_comments.push(cid);
				root_comments_hash[cid] = 1;
			}
		}

		return true;
	}

	html = html || dummyComment(cid);

	if (pid) {
		var tree = $('#tree_' + pid);
		if (tree.length) {
			setDefaultDisplayMode(pid);
			var parent = comments[pid];
			if (front)
				parent['kids'].unshift(cid);
			else
				parent['kids'].push(cid);

			var commtree = $('#commtree_' + pid);
			if (commtree.length) {
				if (front)
					commtree.prepend(html);
				else
					commtree.append(html);
			} else {
				tree.append('<ul id="commtree_' + pid + '">' + html + '</ul>');
			}
		}

	} else {
		var commlist = $('#commentlisting');

		if (commlist.length) {
			root_comments.push(cid);
			root_comments_hash[cid] = 1;

			$('#roothiddens').before(html);
		}
	}

	return true;
}


/****************************/
/* thread utility functions */
/****************************/
function refreshDisplayModes(cid) {
	if (cid > 0) {
		updateDisplayMode(cid, 'full', 1);
		findAffected('focus', cid, 0);
	} else {
		cid = -1 * cid;
		updateDisplayMode(cid, behaviors['collapse']['currentmessage'], 1);
		findAffected('collapse', cid, 1);
	}

	return void(0);
}

function getDescendants(cids, first) {
	// don't include first round of kids in descendants, redundant
	var descs = first ? [] : cids;

	for (var i = 0; i < cids.length; i++) {
		var cid = cids[i];
		var kids = comments[cid]['kids'];
		if (kids.length)
			descs = descs.concat(getDescendants(kids));
	}

	return descs;
}

function faGetSetting(cid, ctype, relation, prevview, canbelower) {
	var newview = behaviors[ctype][relation];
	if (newview == 'none') {
		return prevview;
	} else if (newview == 'prehidden') {
		setDefaultDisplayMode(cid);
		return prehiddendisplaymode[cid];
	}

	if ((viewmodevalue[newview] > viewmodevalue[prevview]) || canbelower) {
		return newview;
	}

	return prevview;
}

function findAffected(type, cid, override) {
	if (!cid) { return }
	var comment = comments[cid];

	var kids = comment['kids'];
	if (kids.length) {
		for (var i = 0; i < kids.length; i++) {
			var kid = kids[i];
			updateDisplayMode(kid, faGetSetting(kid, type, 'children', futuredisplaymode[kid], override));
		}

		var descendants = getDescendants(kids, 1);
		for (var i = 0; i < descendants.length; i++) {
			var desc = descendants[i];
			var thistype = type;
			updateDisplayMode(desc, faGetSetting(desc, thistype, 'descendants', futuredisplaymode[desc], override));
		}
	}
}

function setDefaultDisplayMode(cid) {
	if (displaymode[cid]) { return }

	var comment = fetchEl('comment_' + cid);
	if (!comment) { return }

	var defmode = comment.className.match(/full|hidden|oneline/);
	if (!defmode || !defmode.length || !defmode[0]) { return }

	futuredisplaymode[cid] = prehiddendisplaymode[cid] = displaymode[cid] = defmode[0];
}

function updateDisplayMode(cid, mode, newdefault) {
	if (!mode) { return }

	setDefaultDisplayMode(cid);
	futuredisplaymode[cid] = mode;
	if (newdefault)
		prehiddendisplaymode[cid] = mode;
}

function getSliderTotals(a) {
	// ...called (only) by the D2 slider when it needs to update its integrated labels.

	// It's reasonable to let the slider set the calling conventions.
	var thresh=a[1], hthresh=a[0];

	// |thresh_totals| gives us an object: |{ 3:num_full, 2:num_abbreviated, 1:num_hidden }|.
	// The slider wants an array: |[num_full, num_abbreviated, num_hidden]|.
	// |map()| doesn't re-order; |reduce()| is the tool for this job.
	return core.reduce(thresh_totals[thresh][hthresh], [], function( i, v ){ this[3-i]=v; });
}

function determineMode(cid, thresh, hthresh, lowestmode, skip_read) {
	if (!thresh)
		thresh  = user_threshold;
	if (!hthresh)
		hthresh = user_highlightthresh;

	// lowestmode tells us to NOT change the mode of a comment
	// that is above a certain mode
	if (lowestmode && viewmodevalue[displaymode[cid]] > viewmodevalue[lowestmode])
		return displaymode[cid];

	var mode;
	if (thresh >= 6 || (comments[cid]['points'] < thresh && (user_is_anon || user_uid != comments[cid]['uid'])))
		mode = 'hidden';
	else if (comments[cid]['points'] < (hthresh - (root_comments_hash[cid] ? 1 : 0)))
		mode = 'oneline';
	else
		mode = 'full';

	if (skip_read && comments[cid]['read'] && (viewmodevalue[mode] > viewmodevalue['oneline']))
		mode = 'oneline';

	return mode;
}

function finishCommentUpdates(thresh) {
	for (var cid in update_comments) {
		setDefaultDisplayMode(cid);
		updateComment(cid, update_comments[cid]);
	}

	ajaxFetchComments(fetch_comments, 0, thresh);

	D2.slider.update();
	update_comments = {};
	fetch_comments = [];
	fetch_comments_pieces = {};
	placeholder_comments = [];
	placeholder_no_update = {};
}

// not currently used
function refreshCommentDisplays() {
	var roothiddens = 0;
	for (var root = 0; root < root_comments.length; root++) {
		roothiddens += updateCommentTree(root_comments[root]);
	}
	finishCommentUpdates();

	if (roothiddens) {
		$dom('roothiddens').innerHTML = roothiddens + ' comments are beneath your threshhold';
		$dom('roothiddens').className = 'show';
	} else {
		$dom('roothiddens').className = 'hide';
	}
	/* NOTE need to display note for hidden root comments */
	return void(0);
}

/*******************/
/* misc. functions */
/*******************/
function numsort (a, b) { return (a - b) }

function map_hash( hash, f ) {
	var result = [];
	jQuery.each(hash, function(k, v) {
		result.push(f([k, v]));
	});
	return result;
}

function toHash(thisobject) {
	return map_hash(thisobject, function (pair) {
		return jQuery.map(pair, encodeURIComponent).join(',');
	}).join(';');
}

function toArray(thisobject) {
	return map_hash(thisobject, function (pair) {
		return pair[0];
	});
}

// option = 1: get more, 2: just send update data
// thresh = send threshold
// highlight = 1: go to next comment after loading; 2: collapse previous comment
function ajaxFetchComments(cids, option, thresh, highlight) {
	if (cids && !cids.length)
		return;

	if (!cids && ajaxCommentsWait())
		return;

	if (option && option == 1)
		thresh = 1;

	var options = {};
	var params  = {};
	params['op'] = 'comments_fetch';

	var newoldstuff = cids ? 0 : 1;

	if (cids) {
		params['cids']    = cids;
	} else {
		cids              = [];
		if (option && option == 1 && d2_seen)
			params['d2_seen'] = d2_seen;
		else if (option && option == 2)
			options['async_off'] = 1; // otherwise browser closes before data sent!
		else
			params['cids']    = noshow_comments;
	}

	if (async_off) // global
		options['async_off'] = 1;

	if (thresh) {
		params['threshold']       = user_threshold;
		params['highlightthresh'] = user_highlightthresh;
	}

// we could use this in future if we want to restrict "More" to
// the cid's thread when possible
	if (base_comment)
		params['cid']     = base_comment;
	params['discussion_id']   = discussion_id;

	var abbrev = {};
	for (var i = 0; i < cids.length; i++) {
		if (abbrev_comments[cids[i]] >= 0)
			abbrev[cids[i]] = abbrev_comments[cids[i]];
	}
	params['abbreviated'] = toHash(abbrev);
	params['read_comments'] = toArray(read_comments);
	params['pieces'] = toHash(cids ? fetch_comments_pieces : pieces_comments);

	if (placeholder_comments.length) {
		params['placeholders'] = placeholder_comments;
		params['d2_seen_ex']   = d2_seen;
	}

	var handlers = {
		onComplete: function (transport) {
			var response = eval_response(transport);

			if (!response) {
				ajaxCommentsStatus(0);
				return;
			}

			var update = response.update_data;
			var do_update = (update && update.new_cids_order) ? 1 : 0;
			if (do_update) {
				var root;
				var pids = {};
				for (var i = 0; i < update.new_cids_order.length; i++) {
					var this_cid = update.new_cids_order[i];
					cids.push(this_cid);
					addComment(this_cid, update.new_cids_data[i]);
					if (!comments[this_cid]['pid']) {
						root = 1;
					} else {
						pids[comments[this_cid]['pid']] = 1;
					}
				}

				// for some reason the modification done in addComment
				// invalidates the linkage fetchEl() uses to get
				// an element, so we need to refetch them
				// for now, trying on-demand
				if (is_firefox) {
 					if (root) {
 						reloadForFirefox('commentlisting');
 					} else {
						for (var pid in pids) {
 							reloadForFirefox('tree_' + pid);
 						}
 					}
				}
			}

			json_update(response);

			for (var i = 0; i < cids.length; i++) {
				reloadCommentForFirefox(cids[i]);
				setShortSubject(cids[i]);
			}

			if (do_update) {
				for (var i = 0; i < update.new_cids_order.length; i++) {
					var this_cid = update.new_cids_order[i];
					if (!placeholder_no_update[this_cid] && comments[this_cid]['points'] >= -1) {
						var mode = determineMode(this_cid, null, null, null, (highlight > 1));
						updateDisplayMode(this_cid, mode, 1);
						currents[displaymode[this_cid]]++;
						updateComment(this_cid, mode);
					}

					var this_id  = fetchEl('comment_top_' + this_cid);
					if (this_id)
						last_updated_comments.push(this_cid);
				}

				// later we may need to find a known point and scroll
				// to it, but for now we don't want to do this -- pudge
				//if (!commentIsInWindow(update.new_cids_order[0])) {
				//	scrollWindowTo(update.new_cids_order[0]);
				//}
			}

			if (response.read_comments) {
				for (var i = 0; i < response.read_comments.length; i++) {
					var this_cid = response.read_comments[i];
					// it has been updated now, ignore from now on
					comments[this_cid]['read'] = 1;
					delete read_comments[this_cid];
				}
			}
			if (update && update.new_thresh_totals) {
				for (var thresh in update.new_thresh_totals) {
					for (var hthresh in update.new_thresh_totals[thresh]) {
						for (var mode in update.new_thresh_totals[thresh][hthresh]) {
							thresh_totals[thresh][hthresh][mode] += update.new_thresh_totals[thresh][hthresh][mode];
						}
					}
				}
				$('#titlecountnum').html(thresh_totals[6][6][1]); // total
				D2.slider.update();
			}

			updateHiddens(cids);

			ajaxCommentsStatus(0);

			var next_cid_check = 0;
			var next_cid_lower_thresh = 0;

			if (highlight && last_updated_comments.length)
				next_cid_check = 1;

			if (!d2_comment_order)
				next_cid_lower_thresh = 1;
			else if (!do_update) {
				next_cid_lower_thresh = 1;
				if (highlight)
					next_cid_check = 1;
			}

			if (next_cid_check) {
				var next_cid = 0;

				if (do_update)
					next_cid = commTreeNextComm(0, 0, 1);

//				while (next_cid_lower_thresh && !next_cid && currents['hidden'] > 0 && user_threshold > -1) {
//					alert("No more visible comments; " + currents['hidden'] + " hidden comments.  Dropping threshold from " + user_threshold + " to " + (user_threshold - 1) + ".");
//					user_threshold_save = 0;
//					// if we are collapsing, then do not move HT too, so the comments stay closed
//					changeT(-1, (highlight > 1));
//					D2.slider.setTHT(user_threshold, user_highlightthresh);
//					next_cid = commTreeNextComm(0, 0, 1);
//				}

				if (!next_cid && next_cid_lower_thresh)
					reduceThresholdPrint(highlight);

				else if (next_cid) {
					if (highlight > 1)
						setFocusComment('-' + current_cid, 1);
					setFocusComment(next_cid, 1);
					setCurrentComment(next_cid);
				}
			}

			inlineAdInsert(inlineAdInsertId());
		}
	};

	ajaxCommentsStatus(1);
	ajax_update(params, '', handlers, options);

	if (cids) {
		for (var cid in fetch_comments_pieces) {
			pieces_comments[cid] = 0;
		}

		var remove = [];
		for (var i = 0; i < cids.length; i++) {
			// no Array.indexOf in Safari etc.
			for (var j = 0; j < noshow_comments.length; j++) {
				if (cids[i] == noshow_comments[j]) {
					remove.push(j);
				}
			}
		}
		for (var i = 0; i < remove.length; i++) {
			noshow_comments.splice(remove[i], 1, 0);
		}

		// remove zeroes added above
		for (var i = (noshow_comments.length-1); i >= 0; i--) {
			if (noshow_comments[i] == 0)
				noshow_comments.splice(i, 1);
		}

	} else {
		noshow_comments = [];
		pieces_comments = [];
	}
}

function savePrefs() {
	if (!user_is_anon
		&&
	    user_threshold_save
		&&
	    ((user_threshold_orig != user_threshold)
		||
	    (user_highlightthresh_orig != user_highlightthresh))
	) {
		var params = {};
		params['op'] = 'comments_set_prefs';
		params['threshold'] = user_threshold;
		params['highlightthresh'] = user_highlightthresh;
		params['reskey'] = reskey_static;
		ajax_update(params);

		user_threshold_orig = user_threshold;
		user_highlightthresh_orig = user_highlightthresh;
	}

	return false;
}

function readRest(cid) {
	var shrunkdiv = fetchEl('comment_shrunk_' + cid);
	if (!shrunkdiv)
		return false; // seems we shouldn't be here ...

	var params = {};
	params['op']  = 'comments_read_rest';
	params['cid'] = cid;
	params['sid'] = discussion_id;
//	params['reskey'] = reskey_static;

	var handlers = {
		onComplete: function() {
			shrunkdiv.innerHTML = '';
			var sigdiv = fetchEl('comment_sig_' + cid);
			if (sigdiv) {
				sigdiv.className = 'sig'; // show
			}
		}
	};

	shrunkdiv.innerHTML = '<span class="loading">Loading...</span>';
	ajax_update(params, 'comment_body_' + cid, handlers);

	return false;
}

function doModerate(el) {
	if (user_is_anon)
		return false;

	var matches = el.name.match(/_(\d+)$/);
	var cid = matches[1];

	if (!cid)
		return true;

	el.disabled = 'true';
	var params = {};
	params['op']  = 'comments_moderate_cid';
	params['cid'] = cid;
	params['sid'] = discussion_id;
	params['msgdiv'] = 'reasondiv_' + cid;
	params['reason'] = el.value;
	params['reskey'] = reskey_static;

	var handlers = {
		onComplete: json_handler
	};

	ajax_update(params, '', handlers);

	return false;
}

function cancelReply(pid) {
	var replydiv = $dom('replyto_' + pid);
	replydiv.innerHTML = '';
	if (pid) { // XXX
		var reply_link = $dom('reply_link_' + pid);
		// in some cases this won't exist; if not, fine, we
		// just don't do it
		if (reply_link || !reply_link_html[pid]) {
			reply_link.innerHTML = reply_link_html[pid];
			reply_link_html[pid] = '';
		}
	}
}

function editReply(pid) {
	var replydiv = $dom('replyto_' + pid);
	var reply = $dom('replyto_reply_' + pid);
	var preview = $dom('replyto_preview_' + pid);
	if (!replydiv || !reply || !preview)
		return false;

	setReplyMsg(pid, '');
	preview.style.display = 'none';
	reply.style.display   = 'block';

	$dom('replyto_buttons_2_' + pid).style.display  = 'none';
	$dom('replyto_buttons_1_' + pid).style.display = 'inline';
}

function setReplyMsg(pid, msg) {
	var msgdiv = $('#replyto_msg_' + (pid || 0));
	if (!msgdiv)
		return;

	msgdiv.html(msg);
	if (msg)
		msgdiv.show();
	else
		msgdiv.hide();
}

function replyPreviewOrSubmit (pid, op, handlers) {
	var replydiv = $dom('replyto_' + pid);
	var reply = $dom('replyto_reply_' + pid);
	var preview = $dom('replyto_preview_' + pid);
	var this_reskey = $dom('reskey_reply_' + pid);
	var msgdiv = 'replyto_msg_' + pid;

	if (!replydiv || !reply || !preview || !this_reskey)
		return false;

	var params = {};
	params['op']  = op;
	params['pid'] = pid;
	params['sid'] = discussion_id;
	params['reskey'] = this_reskey.value;
	params['msgdiv'] = msgdiv;
	params['gotmodwarning'] = $dom('gotmodwarning_' + pid).value;
	params['postersubj'] = $dom('postersubj_' + pid).value;
	params['postercomment'] = $dom('postercomment_' + pid).value;

	var hcanswer = $dom('hcanswer_' + pid);
	if (hcanswer)
		params['hcanswer'] = hcanswer.value;

	var postanon = $dom('postanon_' + pid);
	if (postanon && postanon.checked)
		params['postanon'] = postanon.value;

	setReplyMsg(pid, '<span class="loading">Loading...</span>');
	ajax_update(params, '', handlers);
}

function submitReply(pid) {
	return replyPreviewOrSubmit(pid, 'comments_submit_reply', {
		onComplete: function(transport) {
			setReplyMsg(pid, '');
			var response = json_handler(transport);
			var cid = response.cid;
			if (response.error)
				setReplyMsg(pid, response.error);
			else if (cid) {
				cancelReply(pid);
				addComment(cid, { pid: pid, kids: [] }, '', 1);
				setDefaultDisplayMode(cid);
				// add it to the totals (for subtraction in updateComment())
				currents[displaymode[cid]]++;
				setFocusComment(cid, 1, 1);
				var threshes = [-1,0,1,2,3,4,5,6];
				for (var i = 0; i <= threshes.length; i++) {
					var thresh = threshes[i];
					for (var hthresh in thresh_totals[thresh]) {
						var mode = determineMode(cid, thresh, hthresh);
						thresh_totals[thresh][hthresh][ viewmodevalue[mode] ]++;
					}
				}
				$('#titlecountnum').html(thresh_totals[6][6][1]); // total
			}
		}
	});

}

function previewReply(pid) {
	return replyPreviewOrSubmit(pid, 'comments_preview_reply', {
		onComplete: function(transport) {
			setReplyMsg(pid, '');
			var response = json_handler(transport);
			if (response.error)
				setReplyMsg(pid, response.error);
			if (response.html) {
				$('#replyto_reply_' + pid).hide();
				$('#replyto_preview_' + pid).show();
				$('#replyto_buttons_1_' + pid).hide();
				$('#replyto_buttons_2_' + pid).show();
			}
		}
	});
}

function replyTo(pid, nofocus) {
	var replydiv = $('#replyto_' + pid);
	if (!replydiv.length)
		return false; // seems we shouldn't be here ...

	var postercomment = $('#postercomment_' + pid);
	if (postercomment.length) {
		postercomment.focus(); // already have one, bail
		return false;
	}

	var params = {};
	params['op']  = 'comments_reply_form';
	params['pid'] = pid;
	params['sid'] = discussion_id;

	replydiv.html('<span class="loading">Loading...</span>');

	var handlers = {
		onComplete: function(transport) {
			json_handler(transport);
			if (pid) { // XXX
				var reply_link = $('#reply_link_' + pid);
				// in some cases this won't exist; if not, fine, we
				// just don't do it
				if (reply_link.length) {
					reply_link_html[pid] = reply_link.html();
					reply_link.html('<p><b><a href="#" onclick="D2.cancelReply(' + pid + '); return false;">Cancel Reply</a></b></p>');
				}
			}
			if (!nofocus)
				$('#postercomment_' + pid).focus();
		}
	};

	ajax_update(params, '', handlers);

	return false;
}

function submitCountdown(pid, countSecs) {
	var count = $('#submit_countdown_' + pid);
	if (!count.length)
		return;

	var counter = submitCountdowns[pid];
	if (counter)
		clearInterval(counter['counter']); // just in case

	if (!countSecs || countSecs < 1) { // we're at 0, so let's go home
		count.html('');
		return;
	}

	counter = submitCountdowns[pid] = [];
	var date = new Date;
	counter['targetSecs'] = countSecs + (date.getTime() / 1000);
	counter['countSecs']  = countSecs;

	count.html(' (' + countSecs + ')');

	counter['counter'] = window.setInterval(function() {
		var date = new Date;
		var nowSecs = Math.ceil(counter['targetSecs'] - (date.getTime() / 1000));
		if (nowSecs > 0)
			count.html(' (' + nowSecs + ')');
		else {
			count.html('');
			clearInterval(counter['counter']);
		}
	}, 1000);
}

function quoteReply(pid) {
	var this_reply = getQuotedText(comment_body_reply[pid]);
	var postercomment = $dom('postercomment_' + pid) || $dom('postercomment');
	if (postercomment)
		postercomment.value = this_reply + postercomment.value;
	return false;
}

function getQuotedText(this_reply) {
	// tailor whitespace to postmode
	if (!$dom('posttype') || $dom('posttype').value != 2) {
		this_reply = this_reply.replace(/<br>/g, "\n");
	} else {
		this_reply = this_reply.replace(/<br>\n*/g, "<br>\n");
		this_reply = this_reply.replace(/\n*<p>/g, "\n\n<p>");
		this_reply = this_reply.replace(/<\/p>\n*/g, "</p>\n\n");
		this_reply = this_reply.replace(/<\/p>\n\n\n*<p>/g, "</p>\n\n<p>");
	}
	// <quote> parse code takes care of whitespace
	this_reply = this_reply.replace(/\n*<quote>/g, "\n\n<quote>");
	this_reply = this_reply.replace(/^\n+/g, "");
	this_reply = this_reply.replace(/<\/quote>\n*/g, "</quote>\n\n");

	return this_reply;
}


/*********************/
/* utility functions */
/*********************/
function loadAllElements(tagname, parent) {
	if (!parent)
		parent = document;
	var elements = parent.getElementsByTagName(tagname);

	for (var i = 0; i < elements.length; i++) {
		var e = elements[i];
		commentelements[e.id] = e;
	}

	return;
}

function reloadForFirefox(obj_name) {
	if (is_firefox) {
		var obj = $dom(obj_name);
		loadAllElements('span', obj);
		loadAllElements('div', obj);
		loadAllElements('li', obj);
		loadAllElements('a', obj);
	}
}

function reloadCommentForFirefox(cid) {
	if (is_firefox) {
		loadNamedElement('comment_link_' + cid);
		loadNamedElement('comment_shrunk_' + cid);
		loadNamedElement('comment_sig_' + cid);
		loadNamedElement('comment_otherdetails_' + cid);
		loadNamedElement('comment_sub_' + cid);
		loadNamedElement('comment_top_' + cid);
	}
}

function loadNamedElement(name) {
	commentelements[name] = $dom(name);
	return;
}

function fetchEl(str) {
	var obj;

	if (loaded && is_firefox) {
		obj = commentelements[str];
		// any other special cases to ignore? -- pudge
		if (!str.match(/^hidestring_/))
			if (!obj || !grepCommentNode(obj, str))
				obj = commentelements[str] = $dom(str);
	} else {
		obj = $dom(str);
	}

	return obj;
}

// this is a generalized fix for Firefox, to find orphaned nodes
// maybe more than we need? keep this around in case we need,
// but maybe don't use it for now -- pudge
function grepNode(obj, id) {
	if (!id)
		id = '^commentlisting$';
	var parent = obj.parentNode;
	if (!parent)
		return false;
//	if (parent.nodeName == '#document')
	if (parent.id.match(id))
		return parent;
	return grepNode(parent);
}

function grepCommentNode(obj, str) {
	var results = str.match(/^(tree|comment)_(\w+_)?\d+$/);
	if (results)
		return grepNode(obj)
	return true;
}


function finishLoading() {
	if (is_firefox) {
		loadAllElements('span');
		loadAllElements('div');
		loadAllElements('li');
		loadAllElements('a');
	}

	for (var i = 0; i < root_comments.length; i++) {
		root_comments_hash[ root_comments[i] ] = 1;
	}

	if (user_threshold_orig == -9 || user_highlightthresh_orig == -9) {
		user_threshold_orig = user_threshold;
		user_highlightthresh_orig = user_highlightthresh;
	}

	updateHiddens(init_hiddens);

	//window.onbeforeunload = function () { savePrefs() };
	//window.onunload = function () { savePrefs() };

	var noshow_comments_hash = {};
	for (var i = 0; i < noshow_comments.length; i++) { noshow_comments_hash[noshow_comments[i]] = 1 }
	for (var cid in comments) {
		if (!noshow_comments_hash[cid])
			last_updated_comments.push(cid);
	}
	last_updated_comments = last_updated_comments.sort(numsort);
	//root_comments = root_comments.sort(numsort);

	if (1 || user_is_admin) {
		if (window.addEventListener) // DOM method for binding an event
			window.addEventListener('keydown', keyHandler, false);
		else if (window.attachEvent) // IE exclusive method for binding an event
			window.attachEvent('onkeydown', keyHandler)
		else if (document.getElementById) // support older modern browsers
			document.body.onkeydown = keyHandler;
	}

	setCurrentComment(root_comment || last_updated_comments[last_updated_comments_index]);

	//$('.contain').click(vertBarClick);

	if (more_comments_num)
		updateMoreNum(more_comments_num);
	enableControls();

	// if deep in a thread, scroll to fifth grandparent, so we can see
	// some of thread, and the comment requested
	if (root_comment) {
		var this_cid = root_comment;
		for (var i = 0; i < 5; i++) {
			var comm = comments[this_cid];
			var pid = comm.opid || comm.pid;
			if (pid == 0)
				break;
			this_cid = pid;
		}
		scrollWindowTo(this_cid);
	}

	base_comment = root_comment;

	//setTimeout('ajaxFetchComments()', 10*1000);
}


/****************/
/* UI functions */
/****************/
function resetModifiers () {
	shift_down = 0;
	alt_down   = 0;
	ctrl_down  = 0;
	meta_down  = 0;
}

function doModifiers (e) {
	e = e || window.event;
	resetModifiers();

	if (e) {
		if (e.modifiers) {
			if (e.modifiers & Event.SHIFT_MASK)
				shift_down = 1;
			if (e.modifiers & Event.ALT_MASK)
				alt_down = 1;
			if (e.modifiers & Event.CTRL_MASK)
				ctrl_down = 1;
			if (e.modifiers & Event.META_MASK)
				meta_down = 1;
		} else {
			if (e.shiftKey)
				shift_down = 1;
			if (e.altKey)
				alt_down = 1;
			if (e.ctrlKey)
				ctrl_down = 1;
			if (e.metaKey)
				meta_down = 1;
		}
	}
}

function ajaxCommentsWait() {
	return ajaxCommentsWaitQueue.length ? 1 : 0;
}

function ajaxCommentsStatus(bool) {
	boxStatus(bool);

	if (bool)
		ajaxCommentsWaitQueue.push(1);
	else
		ajaxCommentsWaitQueue.shift();

	return true;
}

function boxStatus(bool) {
	var box = $dom('commentControlBoxStatus');
	if (bool) {
		boxStatusQueue.push(1);
		box.className = '';
	} else {
		boxStatusQueue.shift();
		if (!boxStatusQueue.length)
			box.className = 'hide';
	}
}

function enableControls() {
	boxStatus(0);
	var morelink = $('#more_comments_num_a');
	morelink.removeClass('hide');
	morelink.parents('span.nbutton:first').removeClass('hide');

	d2act();
	loaded = 1;
}

function floatButtons () {
	$dom('gods').className='thor';
}

function d2act () {
	var gd = $dom('d2act');
	if (gd) {
		var targetTop = Position('commentwrap').top;
		var vOffset = 0;
		if ( typeof window.pageYOffset == 'number' )
			vOffset = window.pageYOffset;
		else if ( document.body && document.body.scrollTop )
			vOffset = document.body.scrollTop;
		else if ( document.documentElement && document.documentElement.scrollTop )
			vOffset = document.documentElement.scrollTop;

		var oldpos = gd.style.position;

		var mode = $dom('d2out').className;
		if (!user_d2asp && (mode=='horizontal rooted' || targetTop>vOffset)) {
			gd.style.position = 'absolute';
			gd.className      = 'rooted';
			gd.style.top      = '0px';
		} else {
			gd.style.position = 'fixed';
			gd.className      = '';
			gd.style.top      = '0px';
		}

		// for Safari and maybe others, force redraw on change
		if ( oldpos != gd.style.position ) {
			gd.style.display = 'none';
			setTimeout("$dom('d2act').style.display = 'inline'", 1);
			// gd.style.display = 'inline';
		}
	}
}

function toggleDisplayOptions() {
	var gods  = $dom('gods');
	var d2out = $dom('d2out');

	// update user prefs
	var newMode = '';

	var isHidden = gods.style.display == 'none';
	gods.style.display = 'none';

	// none -> ( vertical -> horizontal -> rooted )
	if ( user_d2asp || d2out.className == 'vertical' ) { // vertical->horizontal
		newMode = d2out.className = 'horizontal';
		D2.slider.setOrientation('x');
	} else if ( d2out.className == 'horizontal' ) { // horizontal->rooted
		newMode = 'rooted';
		d2out.className = 'horizontal rooted';
	} else {
		if (!low_bandwidth) { // (rooted, none)->vertical
			newMode = d2out.className = 'vertical';
			D2.slider.setOrientation('y');
		} else { // vertical not happy in low-bandwidth
			newMode = d2out.className = 'horizontal';
			D2.slider.setOrientation('x');
		}
	}

	d2act();
	gods.style.display = 'block';

	if (!user_is_anon) {
		var params = {};
		params['comments_control'] = newMode;
		params['op'] = 'comments_set_prefs';
		params['reskey'] = reskey_static;
		ajax_update(params);
	}

	return false;
}


function updateMoreNum(num) { // should be an integer, or empty string
	if (num == 0)
		num = '';

	var num_a;
	if (!num)
		num_a = 'Get More Comments';
	else {
		if (num == 1)
			num_a = 'Get 1 More Comment';
		else
			num_a = 'Get ' + num + ' More Comments';
	}

	var a = $dom('more_comments_num_a');
	var b = $dom('more_comments_num_b');
	var c = $dom('more_comments_num_c');
	var d = $dom('more_comments_num_d');

	if (a)
		a.innerHTML = num_a;
	if (b)
		b.innerHTML = num;
	if (c)
		c.innerHTML = num;
	if (d)
		d.innerHTML = num;
}


function scrollWindowTo(cid) {
	var comment_y = Position(fetchEl('comment_' + cid)).top;
	if ($dom('d2out').className == 'horizontal')
		comment_y -= 60;
	scroll(Position(window).left, comment_y);
}

function commentIsInWindow(cid, just_head) {
	var	w		= new Bounds(window),
		in_window	= Bounds.contain(w, Position(fetchEl('comment_'+cid))),
		sub		= fetchEl('comment_sub_'+cid);
	return in_window && !just_head && sub ? Bounds.contain(w, Position(sub)) : in_window;
}


function inlineAdInsert(cid) {
	if (!cid)
		return 0;

	if (inlineAdVisibles())
		return 0;

	var tree = $('#tree_' + cid);
	if (tree.length) {
		var adcall = '<iframe src="' + adTimerUrl + '" height="110" width="740" frameborder="0" border="0" scrolling="no" marginwidth="0" marginheight="0"></iframe>';
		var html = '<li id="comment_ad_' + cid + '" class="inlinead"> ' + adcall +'  </li>';

		var commtree = $('#commtree_' + cid);
		if (commtree.length)
			commtree.prepend(html);
		else
			tree.append('<ul id="commtree_' + cid + '">' + html + '</ul>');
		inlineAdReset(cid);
	}
}

function setCurrentComment (cid) {
	if (!cid)
		return false;

	var this_id;
	if (current_cid) {
		if (cid == current_cid)
			return;

		$('#comment_top_' + current_cid).removeClass('newcomment').addClass('oldcomment');
		$('#comment_' + current_cid).removeClass('currcomment');
		$('.current').remove();

		setCommentRead(current_cid);
	}

	$('#comment_top_' + cid).removeClass('newcomment').addClass('oldcomment');
	$('#comment_' + cid).addClass('currcomment').before('<span class="current">&rsaquo;</span>');

	setCommentRead(cid);

	current_cid = cid;
}

function setCommentRead (cid) {
	if (!comments[cid]['read']
		&& !read_comments[cid]
		&& $('#comment_otherdetails_' + cid).length
		&& !noSeeFirstComment(cid)
	) {
		// this happens later for logged-in users
		if (user_is_anon)
			comments[cid]['read'] = 1;
		else
			read_comments[cid] = 1;
	}
}

function updateReadComments () {
	for (var cid in read_comments) {
		ajaxFetchComments(0, 2, '', 1); // if we have at least one, do it
		break;
	}
}

$(window).bind('beforeunload', updateReadComments);



/* keys
prev comment: A, H
next comment: D, L
prev thread: W, K
next thread: S, J
prev comm chrono: Q
next comm chrono: E
next unread comm: F
reply to current comment: R
parent of current comment: P
history (modlog) of current comment: M
hide history: X
skip to end (last): V
skip to top (first): T
get more comments: G
lower top threshold: [
raise top threshold: ]
lower bottom threshold: ,
raise bottom threshold: .
toggle d2 widget: /
*/

var validkeys = {
	A: { thread : 1, prev: 1, comment: 1 },
	D: { thread : 1, next: 1, comment: 1 },
	W: { thread : 1, prev: 1 },
	S: { thread : 1, next: 1 },
	Q: { chrono : 1, prev: 1, comment: 1 },
	E: { chrono : 1, next: 1, comment: 1 },
	F: { thread : 1, next: 1, comment: 1, unread: 1 },

	R: { current : 1, reply   : 1 },
	P: { current : 1, parent  : 1 },
	M: { current : 1, history : 1 },
	X: { current : 1, history : 1, hide : 1 },

	G: { nav: 1, more : 1 },
	T: { nav: 1, skip : 1, top    : 1 },
	V: { nav: 1, skip : 1, bottom : 1 },

	219 : { chr: '[', thresh : 1, top    : 1, down: 1 },
	221 : { chr: ']', thresh : 1, top    : 1, up  : 1 },
	188 : { chr: ',', thresh : 1, bottom : 1, down: 1 },
	190 : { chr: '.', thresh : 1, bottom : 1, up  : 1 },

	191 : { chr: '/', toggle : 1, widget : 1 }
};

validkeys['H'] = validkeys['A'];
validkeys['L'] = validkeys['D'];
validkeys['K'] = validkeys['W'];
validkeys['J'] = validkeys['S'];

//testing
//validkeys['1'] = validkeys['['];
//validkeys['2'] = validkeys[']'];
//validkeys['3'] = validkeys[','];
//validkeys['4'] = validkeys['.'];


function keyHandler(e, k) {
	if (d2_keybindings_off)
		return;

	if (!k)
		e = e || window.event;

	if (k || e) {
		// don't handle for forms ... "type" should handle all our cases here
		if (!k && e.target && e.target.type)
			return;

		var c;
		if (e)
			c = e.keyCode;
		if (k || c) {
			if (!k)
				doModifiers(e);
			var collapseCurrent = shift_down;
			if (d2_reverse_shift)
				collapseCurrent = !collapseCurrent;
			var getNextUnread   = ctrl_down; // not working right, and interfering anyway -- pudge
			var skipit = 0;
			if (meta_down || alt_down || ctrl_down)
				skipit = 1;
			if (!k)
				resetModifiers();
			if (skipit)
				return;

			var update = 0;
			var next_cid = 0;
			var key = k || (validkeys[c] ? c : String.fromCharCode(c));
			if (d2_keybindings_disable[key])
				return;

			var keyo = validkeys[key];
			if (keyo) {
				if (keyo['toggle']) {
					if (keyo['widget'])
						toggleDisplayOptions();

				// keys that rely on current comment
				} else if (keyo['current'] && current_cid) {
					if (keyo['reply'])
						replyTo(current_cid);

					else if (keyo['history']) {
						if (keyo['hide'])
							hide_modal_box(); // this works for ALL modal boxes
						else
							getModalPrefs('modcommentlog', 'Moderation Comment Log', current_cid);

					} else if (keyo['parent']) {
						if (current_cid && comments[current_cid] && comments[current_cid]['pid'])
							next_cid =
								comments[current_cid]['opid']
									||
								comments[current_cid]['pid'];
							update = 1;
					}


				// misc. navigation keys
				} else if (keyo['nav']) {
					if (keyo['more'])
						ajaxFetchComments(0, 1);

					else if (keyo['skip']) { // XXX how to find top/bottom?
						if (keyo['top']) {
							next_cid = commTreeFirstComm();
							update = 1;
						} else if (keyo['bottom']) {
							next_cid = commTreeLastComm();
							update = 1;
						}
					}

				// threshold keys keys
				} else if (keyo['thresh']) {
					if (keyo['top'])
						changeHT(keyo['up'] ? 1 : -1);
					if (keyo['bottom'])
						changeT((keyo['up'] ? 1 : -1), 1);
					D2.slider.setTHT(user_threshold, user_highlightthresh);


				// forward and back between comments, in order of how they were loaded
				} else if (keyo['chrono']) {
					var i = last_updated_comments_index;
					var l = last_updated_comments.length - 1;
					update = 1;

					if (keyo['prev']) {
						if (i <= 0) {
							// this did go back to end; nothing, for now
							//i = l;
						} else
							i = i - 1;
					} else if (keyo['next']) {
						if (i >= l) {
							if (ajaxCommentsWait())
								return;
							update = 2;
							ajaxFetchComments(0, 1, '', 1);
						} else {
							if (!i && noSeeFirstComment(last_updated_comments[i]))
								comments_started = 1; // only come here once
							else
								i = i + 1;
						}
					}

					if (update == 1) {
						last_updated_comments_index = i;
						next_cid = last_updated_comments[i];
					}
				}

				// forward and back between threads, and comments within each thread
				else if (keyo['thread']) {
					update = 1;
					if (keyo['next']) {
						if (keyo['unread'])
							getNextUnread = 1;
						if (current_cid && noSeeFirstComment(current_cid, getNextUnread))
							next_cid = current_cid;
						else {
							if (keyo['comment']) {
								next_cid = commTreeNextComm(current_cid, 0, getNextUnread);
								if (!next_cid) { // && getNextUnread) {
									if (ajaxCommentsWait())
										return;
									update = 2;
									var highlight = 1 + collapseCurrent;
									ajaxFetchComments(0, 1, '', highlight);
								}
							} else
								next_cid = commTreeNextComm(comments[current_cid].pid, current_cid, getNextUnread);
						}
					}

					else if (keyo['prev'] && keyo['comment'])
						next_cid = commTreePrevComm(current_cid);

					else if (keyo['prev'])
						next_cid = commTreePrevComm(current_cid, 1);
				}
			}

			if (update && next_cid) {
				comments_started = 1;
				if (collapseCurrent && current_cid)
					setFocusComment('-' + current_cid, 1);
				if (update == 1)
					setFocusComment(next_cid, 1);
			}
		}
	}
}

// at first comment, and comment is not in window OR comment is not full
function noSeeFirstComment (cid, getNextUnread) {
	setDefaultDisplayMode(cid);
	if (!comments_started && (!commentIsInWindow(cid) || (viewmodevalue[displaymode[cid]] < viewmodevalue['full']))) {
		if (!getNextUnread || isUnread(cid))
			return 1;
	}
	return 0;
}

// XXX somehow sync this with the prev/next by load order?  might require
// a quick grep to find the position
function commTreeNextComm (cid, old_cid, getNextUnread, no_parent) {
	var kids;
	if (cid)
		kids = sortKids(cid);
	else
		kids = rootSort();

	var seen = 0;
	for (var i = 0; i < kids.length; i++) {
		var this_cid;
		if (!old_cid) {
			this_cid = kids[i];
		} else if ((kids[i] == old_cid) || seen) {
			this_cid = kids[i+1];
			seen = 1;
		}

		if (this_cid) {
			if (!getNextUnread) {
				setDefaultDisplayMode(this_cid);
				if (displaymode[this_cid] == 'hidden' || comments[this_cid]['points'] <= -2) {
					// try to dig deeper to find non-hidden
					// if available
					if (comments[this_cid].kids.length) {
						var this_child = commTreeNextComm(
							this_cid,
							0,
							getNextUnread,
							1
						);
						if (this_child)
							return this_child;
					}
				} else
					return this_cid;
			} else if (this_cid = getNextUnreadCid(this_cid))
				return this_cid;
		}
	}

	// no_parent is if we are doing the "dig deeper" for non-hiddens
	// we don't want to climb back out
	if (!cid || no_parent)
		return 0; // at the end, stay where we are

	// we can't continue here, go back up a level
	return commTreeNextComm(comments[cid].pid, cid, getNextUnread);
}

function commTreeLastComm () {
	var this_cid = current_cid;
	if (!current_cid)
		this_cid = last_updated_comments[0];
	for (;;) {
		var new_cid = commTreeNextComm(this_cid);
		if (!new_cid)
			return this_cid;
		this_cid = new_cid;
	}
}

function commTreeFirstComm () {
	var this_cid = current_cid;
	if (!current_cid)
		this_cid = last_updated_comments[0];
	for (;;) {
		var new_cid = commTreePrevComm(this_cid, 2);
		if (!new_cid)
			return this_cid;
		this_cid = new_cid;
	}
}

function commTreePrevComm (cid, to_parent) {
	if (!cid)
		return;
	var root_kids = rootSort();
	var comm = comments[cid];
	if (!comm)
		return;
	var pid = comm.pid;

	if (to_parent == 1) {
		if (pid)
			return pid;
		else // if in roots, then just climb up roots
			return commTreePrevComm(cid, 2);
	}

	var kids;
	if (pid)
		kids = sortKids(pid);
	else
		kids = root_kids;

	for (var i = 0; i < kids.length; i++) {
		if (cid == kids[i]) {
			if (i == 0) // go up
				return pid;
			else if (to_parent)
				return kids[i - 1];
			else
				return getLastChild(kids[i - 1]);
		}
	}
}

function rootSort() { // maybe cache later
	return root_comments; //.sort(numsort);
}

function sortKids(cid) { // maybe cache later
	return comments[cid].kids; //.sort(numsort);
}

function isUnread(cid) {
	// XXX should we loook at read_comments[cid],
	// not just comments[cid]['read'] ?  -- pudge
	setDefaultDisplayMode(cid);
	// skip if hidden, or a placeholder (-2)
	if (
		(
			(displaymode[cid] != 'hidden')
				&&
			(
				(parseInt(comments[cid]['read']) == 0)
					&&
				!read_comments[cid]
			)
				&&
			(comments[cid]['points'] > -2)
		)
	) {
		return 1;
	} else if (parseInt(comments[cid]['read']) == 1) {
		// sometimes things happen in the wrong order, and
		// a comment was not fully rendered when it was set
		// to read, so clean up here just in case; this is a
		// good place to do it, because this is where we might
		// be confused if we are going to the next unread
		// comment, but it is already read, but looks like
		// it is not -- pudge
		$('#comment_top_' + cid).removeClass('newcomment').addClass('oldcomment');
		return 0;
	}
}

function getNextUnreadCid(cid) {
	if (isUnread(cid))
		return cid;
	var kids = sortKids(cid);
	for (var i = 0; i < kids.length; i++) {
		var next_cid = getNextUnreadCid(kids[i]);
		if (next_cid)
			return next_cid;
	}
	return 0;
}

function getLastChild(cid) {
	var kids = sortKids(cid);
	if (kids.length)
		return getLastChild(kids[kids.length - 1]);
	else
		return cid;
}


function dummyComment(cid) {
	var html = '<li id="tree_--CID--" class="comment">\
<div id="comment_status_--CID--" class="commentstatus"></div>\
<div id="comment_--CID--" class="hidden">\
</div>\
\
<div id="replyto_--CID--"></div>\
\
<ul id="group_--CID--">\
	<li id="hiddens_--CID--" class="hide"></li>\
</ul>\
</li>';

	return(html.replace(/\-\-CID\-\-/g, cid));
}

function reduceThreshold(highlight, no_save) {
	if (highlight < 0) {
		hide_modal_box();
		no_lower_threshold = 1;
		return;
	}

	if (no_save)
		user_threshold_save = 0;

	hide_modal_box();
	$('#modal_box_content').html('');

	// this could trigger a comment load, which could interfere with the
	// comment load on setFocusComment if they return in the wrong order
	async_off = 1;

	// if we are collapsing, then do not move HT too, so the comments stay closed
	changeT(-1, (highlight > 1), 'hidden');
	D2.slider.setTHT(user_threshold, user_highlightthresh);
	async_off = 0;

	var next_cid = commTreeNextComm(0, 0, 1);
	if (!next_cid)
		return;
	if (highlight)
		setFocusComment('-' + current_cid, 1);
	setFocusComment(next_cid, 1);
	setCurrentComment(next_cid);
}

function reduceThresholdPrint(highlight) {
	if (currents['hidden'] <= 0 || user_threshold <= -1 || no_lower_threshold)
		return;

	$('#preference_title').html('No More Comments At This Threshold');
	show_modal_box();

	var html = '<div>\
<p>There are no more comments available at Score:--SCORE--, but there might be more at Score:--SCORE1--.</p><p>Would you like to lower your threshold for \
<input type="button" value="this" onclick="D2.reduceThreshold(--HIGHLIGHT--,1)"> ';
	if (!user_is_anon)
		html = html + '<input type="button" value="all"  onclick="D2.reduceThreshold(--HIGHLIGHT--)"> ';
	html = html + 'discussion(s)?<br>\
<input type="button" value="No Thanks" onclick="D2.reduceThreshold(-1)">\
</p>\
\
<p><i>(Remember that you can always adjust these controls with the slider widget \
visible to the --LEFTORTOP-- of the discussion.)</i></p>\
</div>';

	html = html.replace(/\-\-SCORE\-\-/g, user_threshold);
	html = html.replace(/\-\-SCORE1\-\-/g, (user_threshold-1));
	html = html.replace(/\-\-HIGHLIGHT\-\-/g, highlight);

	var leftortop = $('#d2out').hasClass('horizontal') ? 'top' : 'left';
	html = html.replace(/\-\-LEFTORTOP\-\-/g, leftortop);

	$('#modal_box_content').html(html);
}

var packageObj = {
	// methods
	ajaxFetchComments:      ajaxFetchComments,
	boxStatus:              boxStatus,
	cancelReply:            cancelReply,
	d2act:                  d2act,
	doModerate:             doModerate,
	editReply:              editReply,
	finishLoading:          finishLoading,
	previewReply:           previewReply,
	quoteReply:             quoteReply,
	readRest:               readRest,
	reduceThreshold:        reduceThreshold,
	replyTo:                replyTo,
	revealKids:             revealKids,
	selectParent:           selectParent,
	setFocusComment:        setFocusComment,
	submitCountdown:        submitCountdown,
	submitReply:            submitReply,
	toggleDisplayOptions:   toggleDisplayOptions,
	updateMoreNum:          updateMoreNum,

	changeTHT:              changeTHT,
	getSliderTotals:        getSliderTotals
};

Slash.Util.qw.each('\
	abbrev_comments \
	adTimerUrl \
	comment_body_reply \
	comments \
	currents \
	d2_comment_order \
	d2_keybindings_disable \
	d2_keybindings_off \
	d2_reverse_shift \
	d2_seen \
	discussion_id \
	init_hiddens \
	more_comments_num \
	noshow_comments \
	pieces_comments \
	placeholder_no_update \
	base_comment \
	root_comment \
	root_comments \
	root_comments_hash \
	thresh_totals \
	user_d2asp \
	user_highlightthresh \
	user_is_admin \
	user_is_anon \
	user_is_subscriber \
	user_threshold \
	user_uid \
	', function(){
	packageObj[this] = eval('("IE bug workaround",(function(v){ if (v===undefined) return '+this+'; '+this+'=v;}))');

});

Slash.Util.Package({
	named: 'Slash.Discussion',
	api: packageObj
});

})(Slash.jQuery); // (function($){


// Globals
var D2=Slash.Discussion;


(function(){
// The D2 slider.

// We use a lot of "absolute" selectors; if you ever wanted more than one D2 slider
// that would have to change.

	// "constants"
var	MAX_SCORE		= 6,
	MIN_SCORE		= -1,
	SCORE_RANGE		= [ MAX_SCORE, MIN_SCORE ],

	BUCKET_NAMES	= [ 'full', 'abbr', 'hide' ],
	LAST_BUCKET		= BUCKET_NAMES.length-1,

	T_THUMB			= 1,
	HT_THUMB		= 0,

	Y_MODE_SLICE_HEIGHT	= 20,
	AXES			= {
		y: {
			name:		'y',
			i:			1,
			startEdge:	'top',
			endEdge:	'bottom',
			units:		'px',
			scale:		Y_MODE_SLICE_HEIGHT
		},

		x: {
			name:		'x',
			i:			0,
			startEdge:	'left',
			endEdge:	'right',
			units:		'%',
			scale:		100.0 / (MAX_SCORE-MIN_SCORE)
		}
	},

	// "globals" at least within this block; this would also have to change for multiple sliders.
	cur_axis		= AXES.y, // vertical by default
	$control, before, current;


function getStart( o ){
	return Position(o)[cur_axis.startEdge];
}

function grid( $thumb ){
	var g = [
		AXES.x.scale * $control.width() / 100.0,
		AXES.y.scale
	];
	return arguments.length ? $thumb.draggable('option', 'grid', g) : g;
}

function thumb_value( expr, new_value ){
	// Get or set the value of a thumb; setting implies positioning the thumb physically as well.

	var	have_thumb	= typeof(expr)!=='number',
		$thumb		= $(expr),
		value		= have_thumb
						? $thumb.data('thumb-value')
						: MAX_SCORE - Math.round((expr - getStart($control)) / grid()[cur_axis.i]);

	// thumb_value(thumb) => return current value of |thumb|
	// thumb_value(number) => return the value as if from a |thumb| positioned at |number| pixels from the widget start
	if ( new_value===undefined || new_value===null || !have_thumb ) {
		return value;
	}

	if ( new_value != value ) {
		if ( typeof(new_value)==='number' ) {
			// thumb_value(el, 3) => set a value in |thumb|, moving it accordingly
			$thumb.data('thumb-value', new_value=pin_between(MIN_SCORE, new_value, MAX_SCORE));
		} else {
			// thumb_value(el, 'x') => re-orient |thumb|
			if ( new_value==='x' || new_value==='y' ) {
				$thumb.draggable('option', 'axis', new_value);
			}
			new_value = value;
		}

		// Reposition |$thumb|.
		var new_css={
			display: 'block',
			top: 0,
			left: 0
		};
		// ...overriding one of the above.
		new_css[cur_axis.startEdge] = (MAX_SCORE-new_value) * cur_axis.scale + cur_axis.units;
		$thumb.css(new_css);
	}

	return $thumb;
}


function init_thumb( id_fragment, key, getter, setter ){
	var $thumb = $(id_fragment+'-pos');

	return $thumb.
		draggable({
			handle:			id_fragment + ',' + id_fragment + '-tab',
			axis:			cur_axis.name,
			containment:	$control.parent()[0],

			start:			function( event, ui ){
								before=(current=getter()).slice();
								grid($thumb);

								$control.addClass('ccw-active');
							},

			drag:			function( event, ui ){
								var	v = thumb_value(getStart($thumb));
								if ( v != current[key] ) {
									$thumb.data('thumb-value', current[key]=v);
									setter(current);
								}
							},

			stop:			function( event, ui ){
								$control.removeClass('ccw-active');

								D2.changeTHT(
									current[T_THUMB]-before[T_THUMB],
									current[HT_THUMB]-before[HT_THUMB]
								);
							}
		});
}



function D2Slider( T, HT, axis ) {
	$control = $any('ccw-control');
	cur_axis = AXES[ axis || 'y' ];

	var slider=this;
	function getter(){
		return slider.thresholds();
	}

	this.thumbs = core.map(['abbr', 'hide'], function( i ){
		return init_thumb('#ccw-'+this+'-bar', i, getter, function( a ){ slider._setTs(a, i); });
	});

	return this.setTHT(T, HT);
}
Slash.Discussion.Slider = D2Slider;

D2Slider.prototype = {

	thresholds: function(){
		return core.map(this.thumbs, function(){
			return thumb_value(this);
		});
	},

	setTHT: function( T, HT ) {
		return this._setTs([HT, T]);
	},

	stepTHT: function( which, delta ) {
		var newTs = this.thresholds();
		newTs[which] += delta;

		return this._setTs(newTs);
	},

	setOrientation: function( new_axis_name ) {
		var old_axis = cur_axis;

		if ( new_axis_name in AXES && new_axis_name!==old_axis.name ) {
			cur_axis = AXES[new_axis_name];

			core.each(BUCKET_NAMES, function( i, bucket_name ){
				function $part( id_fragment ){ return $any('ccw-'+bucket_name+'-'+id_fragment); }

				// The edges that moved along |old_axis| now "lock" to the slider bounds.
				var new_css={};
				i &&				(new_css[old_axis.startEdge] = 0);
				i!=LAST_BUCKET &&	(new_css[old_axis.endEdge] = 0);
				$part('panel').css(new_css);

				$part('phrase').css({ display: 'inline' });
				$part('count-pos').css({ top: 0 });
			});

			// Thumbs fix themselves.
			core.each(this.thumbs, function(){
				thumb_value(this, new_axis_name);
			});

			// Fix the edges perpendicular the new |cur_axis|.
			this._setTs();
		}
		return this;
	},

	update: function(){
		return this._setTs();
	},

	_setTs: function( newTs, dragged_thumb ) {
		// Update the widget display to reflect new orientation or thresholds.

		switch ( arguments.length ){
			default:	// We are updating the thresholds, live, during a thumb-drag.
				// Move the other thumb aside if needed to make room for the dragged_thumb.
				var pin_fn	= dragged_thumb ? Math.max : Math.min,
					other	= 1 - dragged_thumb;

				newTs[other]	= pin_fn(newTs[dragged_thumb], before[other]);
				// fall through

			case 1:		// We are updating the thresholds; move the thumbs accordingly.
				core.each(this.thumbs, function( i, $thumb ){
					// The dragged_thumb is positioned correctly by definition.
					i===dragged_thumb || thumb_value($thumb, newTs[i]);
				});
				// fall through

			case 0:		// The thumbs have the correct (possibly pinned) thresholds.
				newTs = this.thresholds();
		}


		// Fix-up the layout of the labels.
		// This code fixes drag-related edges (perpendicular to |cur_axis|).  See
		// setOrientation for the rest of the story.

		var	comment_count	= D2.getSliderTotals(newTs),
			end_offset		= (MAX_SCORE-MIN_SCORE)*cur_axis.scale;

		core.reduce(newTs.concat(MIN_SCORE), 0, function( i, v, prev_offset ){
			function $part( x ){ return $any('ccw-'+BUCKET_NAMES[i]+'-'+x); }

			var	offset	= (MAX_SCORE-v)*cur_axis.scale,
				length	= offset - prev_offset,
				hide	= !length;

			// The "panels" are the three space-filling divs visually representing ranges defined by the thumbs.
			// Here we snap their ends to the thumb positions, or to the slider-ends as appropriate.
			var new_css={};
			i &&				(new_css[cur_axis.startEdge]	= prev_offset + cur_axis.units);
			i!=LAST_BUCKET &&	(new_css[cur_axis.endEdge]	= (end_offset-offset) + cur_axis.units);
			$part('panel').css(new_css);

			// Each has a label showing the number of comments in that "bucket".
			$part('count-text').css({ display: hide ? 'none' : 'block' }).	// Hide the label within a zero-width panel.
				children('span:first').html(comment_count[i]);				// Set the new comment total.
			switch ( hide || cur_axis.name ) {
				// These parts are inside the count-text; if that's hidden, there's nothing to do.
				case 'x': $part('phrase').css({ display: length>cur_axis.scale ? 'inline' : 'none' }); break;
				case 'y': $part('count-pos').css({ top: (length/2) + cur_axis.units }); break;
			}

			return offset; // ...given back to us as prev_offset on the next pass.
		});
		return this;
	}

};

})();
