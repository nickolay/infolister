<?xml version="1.0" encoding="UTF-8"?>

<!--
 XSLT: InfoLister output XML -> XHTML
 Copyright (c) 2004-2005, Nickolay Ponomarev <asqueella at gmail dot com>
 
 Feel free to use and modify this file to better suit your needs.
 Please contact me if you think your improvements may be useful to others. 
-->

<xsl:stylesheet version="1.0"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns="http://www.w3.org/1999/xhtml">

<xsl:output method="html"
            media-type="application/xhtml+xml"
            doctype-public="-//W3C//DTD XHTML 1.1//EN"
            doctype-system="DTD/xhtml11.dtd"/>

<xsl:template match="/info">
  <html>
  <head>
    <title>My <xsl:value-of select="@app"/> information</title>
    <link rel="stylesheet" type="text/css" href="ExtensionsList.css"/>
  </head>
  <body>
    <xsl:apply-templates />
    <div class="bottomnote">
      Generated with <a href="http://mozilla.klimontovich.ru/infolister">InfoLister</a> extension.
    </div>
  </body>
  </html>
</xsl:template>

<xsl:template match="lastupd">
  <div class="lastupd">
    <span class="hdr">Last updated: </span><xsl:value-of select="."/>
  </div> 
</xsl:template>

<xsl:template match="useragent">
  <div class="useragent">
    <span class="hdr">User Agent: </span><xsl:value-of select="."/>
  </div>
</xsl:template>

<xsl:template match="extensions"> <!-- xxx onelist -->
  <div class="extensions">   
    <h3><span class="hdr">Extensions</span> 
    (enabled: <xsl:value-of select="count(ext[@disabled!=true()])"/>, 
     disabled: <xsl:value-of select="count(ext[@disabled])"/>):</h3>
    <ul> <!-- xxx ?if? -->
      <xsl:for-each select="ext">
        <xsl:apply-templates select="."/>
      </xsl:for-each>
    </ul>
  </div>
</xsl:template>

<xsl:template match="themes">
  <div class="themes">
    <h3><span class="hdr">Themes</span> (<xsl:value-of select="count(theme)"/>):</h3>
    <ul>
      <xsl:for-each select="theme">
        <xsl:apply-templates select="."/>
      </xsl:for-each>
    </ul>
  </div>
</xsl:template>

<xsl:template match="plugins">
  <div class="plugins">
    <h3><span class="hdr">Plugins</span> (<xsl:value-of select="count(plugin)"/>):</h3>
    <ul>
      <xsl:for-each select="plugin">
        <xsl:apply-templates select="."/>
      </xsl:for-each>
    </ul>
  </div>
</xsl:template>

<xsl:template match="ext|theme|plugin">
  <li>
    <a>
      <xsl:if test="@homepageURL">
        <xsl:attribute name="href"><xsl:value-of select="@homepageURL"/></xsl:attribute>
      </xsl:if>
      <xsl:if test="@description">
        <xsl:attribute name="title"><xsl:value-of select="@description"/></xsl:attribute>
      </xsl:if>
      <xsl:value-of select="text()"/>
    </a>

    <xsl:text> </xsl:text>
    <xsl:value-of select="@version"/>
    
    <xsl:if test="@creator">
      <xsl:text> by </xsl:text><xsl:value-of select="@creator"/>
    </xsl:if>

    <xsl:if test="@disabled">
      <xsl:text> [disabled]</xsl:text>
    </xsl:if>
  
    <xsl:if test="@selected">
      <xsl:text> [selected]</xsl:text>
    </xsl:if>
  </li>
</xsl:template>

</xsl:stylesheet>
