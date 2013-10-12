noodles
=======

Noodles is node.js container designed to jumpstart a 24-hour hack day
project. It contains many fully working code samples for retrieving
and presenting data from popular sites. The code is organized in a way
to make it easy to copy, paste, mash, and modify for use in your hack.

## Installation

    % git clone git@github.com:patc888/noodles.git
    % ./noodles/bin/start

  Point your browser to [localhost:3000](localhost:3000) and you're up and running.

## Creating a webpage

    % echo "<h1>My Hack</h1>" > noodles/webpages/my_hack.html

  In your browser, visit [localhost:3000/my\_hack.html](localhost:3000/my_hack.html).
  The system will automatically load any changes you make to the my_hack.html file.

## Creating a RESTful api endpoint

    % cp noodes/apis/echo_1.js noodles/apis/my_hack.js

  In your browser, visit [localhost:3000/apis/my\_hack?msg=Ramen](localhost:3000/apis/my_hack?msg=Ramen).
  The system will automatically load any changes you make to the my_hack.js file.
  You can now call your new REST from javascript in a webpage or from your phone.
