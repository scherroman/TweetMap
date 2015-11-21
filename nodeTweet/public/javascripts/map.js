var selectedButtons = [];

//MapWordButton click
$(document).ready(function(){
    $(".mapWordButton").click(function(){

        if ($.inArray(this, selectedButtons) == -1) {
            console.log("MapWordButton Select");
            selectedButtons.push(this);
            $(this).toggleClass('selected');
        }
        else {
            console.log("MapWordButton Unselect");
            var index = $.inArray(this, selectedButtons);
            if (index > -1) {
                selectedButtons.splice(index, 1);
            }
            $(this).removeClass('selected');
        }
    });
});