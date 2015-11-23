var TERM_SEARCH = 'term'
var THEME_SEARCH = 'theme'

var TWEET_COUNT_INCREMENT = 20;

//searchButton click
$(document).ready(function(){
    $(".searchButton").click(function(){

    	// console.log("Sender: ", $(this));

        var currentInput = getUrlParameter('input');
        var currentType = getUrlParameter('type');
        var tweetCount = getUrlParameter('count');
        tweetCount = parseInt(tweetCount);

    	var searchQuery = {
            input: null,
    		type: null,
    		count: -1
    	};

    	//Term Search
    	if($(this).attr('id') == 'searchTermButton') {

    		var term = $('#search-query').val();
    		term = $.trim(term);
    		term = term.toLowerCase();

    		searchQuery.type = TERM_SEARCH;
    		searchQuery.input = term;
            searchQuery.count = 0;
    	}
    	//Theme Search
    	else if ($(this).attr('id') == 'searchThemeButton') {

    		var theme = $('#search-query').val();
    		theme = $.trim(theme);
    		theme = theme.toLowerCase();

            searchQuery.input = theme;
    		searchQuery.type = THEME_SEARCH;
            searchQuery.count = 0;
    	}
        else if ($(this).attr('id') == 'nextButton') {

            searchQuery.input = currentInput;
            searchQuery.type = currentType;
            searchQuery.count = tweetCount + TWEET_COUNT_INCREMENT;
        }
        else if ($(this).attr('id') == 'prevButton') {

            searchQuery.input = currentInput;
            searchQuery.type = currentType;
            searchQuery.count = tweetCount - TWEET_COUNT_INCREMENT;
        }
        else {
            var term = $('#search-query').val();
            term = $.trim(term);
            term = term.toLowerCase();

            searchQuery.type = TERM_SEARCH;
            searchQuery.input = term;
            searchQuery.count = 0;
        }

    	console.log("SearchQuery: ", searchQuery);

    	if (searchQuery.type) {

            //Form query      
            var query = $.param({
                input: searchQuery.input,
                type: searchQuery.type, 
                count: searchQuery.count
            });

            //Reload page with query
            var url = [location.protocol, '//', location.host, location.pathname].join('');
            url = url.concat("?").concat(query);
            window.location.href = url;
	    }
    });
});

//Extracts values from current url
var getUrlParameter = function getUrlParameter(sParam) {
    var sPageURL = decodeURIComponent(window.location.search.substring(1)),
        sURLVariables = sPageURL.split('&'),
        sParameterName,
        i;

    for (i = 0; i < sURLVariables.length; i++) {
        sParameterName = sURLVariables[i].split('=');

        if (sParameterName[0] === sParam) {
            return sParameterName[1] === undefined ? true : sParameterName[1];
        }
    }
};