var selectedButtons = [];

//MapWordButton click
$(document).ready(function(){
    $("#nextTweetButton").click(function(){
        //Get next tweet by reloading page to get random tweets
        location.reload();
    });
});

//MapWordButton click
$(document).ready(function(){
    $(".mapWordButton").click(function(){
        //Select or unselect button
        if ($.inArray(this, selectedButtons) == -1) {
            selectedButtons.push(this);
            $(this).toggleClass('selected');
        }
        else {
            var index = $.inArray(this, selectedButtons);
            if (index > -1) {
                selectedButtons.splice(index, 1);
            }
            $(this).removeClass('selected');
        }
    });
});

//DoneButton click
$(document).ready(function(){
    $("#doneButton").click(function(){

        $(this).blur();

        var theme = $('#themeInput').val();
        theme = $.trim(theme);
        theme = theme.toLowerCase();
        console.log("themeInput: ", theme);

        //Remove any current alerts
        $(".doneAlert").remove();

        if (theme === null || theme === "") {
            var alert = $('<div>', {
                "class": "doneAlert alert alert-danger",
                text: "Please enter a theme for the tweet!"
            });

            var dismissButton = $('<a>', {
                href: "#",
                "class": "close",
                "data-dismiss": "alert",
                "aria-label": "close",
                html: "&times"
            });

            $(alert).append(dismissButton);
            $('#doneDiv').append(alert);
        }
        else {
            var regx = /^([A-Za-z]+)$|^([A-Za-z]+)([\s]{1})([A-Za-z]+)$/;
            if (!regx.test(theme)) {
                var alert = $('<div>', {
                    "class": "doneAlert alert alert-danger",
                    text: "Please write the theme in plain english with one or two words!"
                });

                var dismissButton = $('<a>', {
                    href: "#",
                    "class": "close",
                    "data-dismiss": "alert",
                    "aria-label": "close",
                    html: "&times"
                });

                $(alert).append(dismissButton);
                $('#doneDiv').append(alert);
            } 
            else {
                //Create new array consisting of text of selectedButtons
                var relatedTerms = [];

                var selectedButtonsLength = selectedButtons.length;
                for (var i = 0; i < selectedButtonsLength; i++) {
                    var selectedButtonText = $(selectedButtons[i]).text();
                    relatedTerms.push(selectedButtonText);

                    // console.log("SelectedButtonText: ", selectedButtonText);
                }

                var relatedTermsJsonArray = JSON.stringify(relatedTerms);

                //Send the theme & related terms to the server
                $.ajax({
                    url: window.location.pathname,
                    type: "POST",
                    data: {theme: theme, relatedTerms: relatedTermsJsonArray},
                    dataType: "json",
                    success: function (result) {
                        console.log(result);
                    },
                    error: function (xhr, ajaxOptions, thrownError) {
                        console.log("Ajax request failure");
                        console.log(xhr.status);
                    }
                });

                location.reload();
            }
        }
    });
});